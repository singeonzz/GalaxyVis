import { basicData, globalProp } from '../../../initial/globalProp'
import { CreateGPUBuffer, CreateGPUBufferUint } from '../../../utils/webGPUtils'
import { mat4, glMatrix } from 'gl-matrix'
import edgeVert from '../shaders/edge.vert.wgsl'
import edgeFrag from '../shaders/edge.frag.wgsl'
import arrowVert from '../shaders/arrow.vert.wgsl'
import arrowFrag from '../shaders/arrow.frag.wgsl'

import { newfloatColor } from '../../../utils'

const edgeGroups = globalProp.edgeGroups
const twoGroup = 2
const ATTRIBUTES = 2
const ARROWATTRIBUTES = 6

const arrowVertexData = new Float32Array([-1, -1, 0, 0, 1, -1, 1, 0, -1, 1, 0, 1, 1, 1, 1, 1])

export default class EdgeGPUProgram {
    private gpu: {
        device: GPUDevice
        canvas: HTMLCanvasElement
        format: GPUTextureFormat
        context: any
    }

    private graph: any
    private matsBindGroupLayout: GPUBindGroupLayout | undefined
    private pipeline: GPURenderPipeline | undefined
    private isInit = true
    private bindGroupLayout: GPUBindGroupLayout | undefined
    private maxMappingLength: number
    private bindArrowGroupLayout: GPUBindGroupLayout | undefined
    private matsBindArrowGroupLayout: GPUBindGroupLayout | undefined
    private arrowPipeline: GPURenderPipeline | undefined
    private hasArrowInit = true

    constructor(graph: any) {
        this.graph = graph
        this.gpu = graph.gpu
        this.maxMappingLength = (14 * 1024 * 1024) / Float32Array.BYTES_PER_ELEMENT
    }

    async initPineLine() {
        const { device, format } = this.gpu

        const bindGroupLayout = (this.bindGroupLayout = device.createBindGroupLayout({
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.VERTEX,
                    buffer: {
                        type: 'uniform',
                        minBindingSize: ATTRIBUTES * 4,
                    },
                },
            ],
        }))

        const matsBindGroupLayout = (this.matsBindGroupLayout = device.createBindGroupLayout({
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.VERTEX,
                    buffer: {
                        type: 'uniform',
                        minBindingSize: 64 * 2,
                    },
                },
            ],
        }))

        const pipelineLayout = device.createPipelineLayout({
            bindGroupLayouts: [bindGroupLayout, matsBindGroupLayout],
        })

        const pipelineDesc = {
            layout: 'auto',
            vertex: {
                module: device.createShaderModule({
                    code: edgeVert,
                }),
                entryPoint: 'main',
                buffers: [
                    {
                        arrayStride: 2 * 4,
                        stepMode: 'vertex',
                        attributes: [
                            {
                                shaderLocation: 0,
                                offset: 0,
                                format: 'float32x2',
                            },
                        ],
                    },
                    {
                        arrayStride: 2 * 4,
                        stepMode: 'vertex',
                        attributes: [
                            {
                                shaderLocation: 1,
                                offset: 0,
                                format: 'float32x2',
                            },
                        ],
                    },
                ],
            },
            fragment: {
                module: device.createShaderModule({
                    code: edgeFrag,
                }),
                entryPoint: 'main',
                targets: [
                    {
                        format,
                        blend: {
                            color: {
                                srcFactor: 'src-alpha',
                                dstFactor: 'one-minus-src-alpha',
                            },
                            alpha: {
                                srcFactor: 'src-alpha',
                                dstFactor: 'one-minus-src-alpha',
                            },
                        },
                    },
                ],
            },
            primitive: {
                topology: 'triangle-strip',
                frontFace: 'ccw',
                cullMode: 'none',
            },
        }

        // @ts-ignore
        this.pipeline = device.createRenderPipeline({
            ...pipelineDesc,
            layout: pipelineLayout,
        })

        this.isInit = false
    }

    async initArrowPineLine() {
        const { device, format } = this.gpu

        const bindGroupLayout = (this.bindArrowGroupLayout = device.createBindGroupLayout({
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.VERTEX,
                    buffer: {
                        type: 'uniform',
                        minBindingSize: ARROWATTRIBUTES * 4,
                    },
                },
            ],
        }))

        const matsBindGroupLayout = (this.matsBindArrowGroupLayout = device.createBindGroupLayout({
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.VERTEX,
                    buffer: {
                        type: 'uniform',
                        minBindingSize: 64 * 2,
                    },
                },
            ],
        }))

        const pipelineLayout = device.createPipelineLayout({
            bindGroupLayouts: [bindGroupLayout, matsBindGroupLayout],
        })

        const pipelineDesc = {
            layout: 'auto',
            vertex: {
                module: device.createShaderModule({
                    code: arrowVert,
                }),
                entryPoint: 'main',
                buffers: [
                    {
                        // vertex buffer
                        arrayStride: 4 * 4,
                        stepMode: 'vertex',
                        attributes: [
                            {
                                // vertex positions
                                shaderLocation: 0,
                                offset: 0,
                                format: 'float32x2',
                            },
                            {
                                // vertex colors
                                shaderLocation: 1,
                                offset: 2 * 4,
                                format: 'float32x2',
                            },
                        ],
                    },
                ],
            },
            fragment: {
                module: device.createShaderModule({
                    code: arrowFrag,
                }),
                entryPoint: 'main',
                targets: [
                    {
                        format: format,
                        blend: {
                            color: {
                                srcFactor: 'src-alpha',
                                dstFactor: 'one-minus-src-alpha',
                            },
                            alpha: {
                                srcFactor: 'src-alpha',
                                dstFactor: 'one-minus-src-alpha',
                            },
                        },
                    },
                ],
            },
            primitive: {
                topology: 'triangle-list',
                frontFace: 'ccw',
                cullMode: 'none',
            },
        }

        // @ts-ignore
        this.arrowPipeline = device.createRenderPipeline({
            ...pipelineDesc,
            layout: pipelineLayout,
        })

        this.hasArrowInit = false
    }

    async render(passEncoder: any) {
        this.isInit && (await this.initPineLine())
        this.hasArrowInit && (await this.initArrowPineLine())

        const graph = this.graph
        const camera = graph.camera
        const graphId = graph.id
        const { device, canvas } = this.gpu

        // 获取线集合
        let { lineDrawCount: edgeArray, num, plotNum } = this.graph.getEdgeWithArrow()

        let edgeBoundBox = basicData[graphId].edgeBoundBox
        let edgeList = basicData[graphId].edgeList

        let plotsDefPoint = new Float32Array(num * edgeGroups * 4)
        let plotsTwoPoint = new Float32Array(plotNum * twoGroup * 4)

        let plotsDefNormal = new Float32Array(num * edgeGroups * 4)
        let plotsTwoNormal = new Float32Array(plotNum * twoGroup * 4)

        let defL = 0,
            twoL = 0

        const bindGroups = new Array(num + plotNum)
        // 绘制个数
        const numTriangles = num + plotNum
        if (!numTriangles) return

        // uniform属性
        const uniformBytes = ATTRIBUTES * Float32Array.BYTES_PER_ELEMENT
        const alignedUniformBytes = Math.ceil(uniformBytes / 256) * 256
        const alignedUniformFloats = alignedUniformBytes / Float32Array.BYTES_PER_ELEMENT
        // 创建unifromBuffer
        const uniformBuffer = device.createBuffer({
            size: numTriangles * alignedUniformBytes + Float32Array.BYTES_PER_ELEMENT * 16 * 2,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
        })
        const uniformBufferData = new Float32Array(numTriangles * alignedUniformFloats)

        let groups = new Array(),
            def = new Array(),
            two = new Array()

        let arrowGroups = new Array(),
            defArrow = new Array(),
            twoArrow = new Array()

        // to do 提取到@computer中
        edgeArray.forEach((item: any[]) => {
            let r2 = item[2]
            let r2L = r2.length
            let hasArrow = false
            let id = item[3]
            let edgeGroup = item[4]

            let boundBox = edgeBoundBox.get(id)
            let { attrNormal, width, attrMiter, points: attrPoint } = boundBox.points
            let color = edgeList.get(id)?.getAttribute('color') || '#eee'
            let colorFloat = newfloatColor(color)

            if (r2[r2L - 1] == 1) {
                hasArrow = true
                let obj = {
                    x: r2[r2L - 5],
                    y: r2[r2L - 4],
                    angle: r2[r2L - 3],
                    sx: r2[r2L - 2],
                    type: r2[r2L - 1],
                    width,
                    colorFloat,
                }
                if (edgeGroup == edgeGroups) {
                    defArrow.push(obj)
                } else {
                    twoArrow.push(obj)
                }
            }

            // 曲线
            if (edgeGroup == edgeGroups) {
                for (let i = 0, j = 0; i < attrPoint.length; i += 2, j += 1) {
                    plotsDefPoint[defL * edgeGroups * 4 + i] = attrPoint[i]
                    plotsDefPoint[defL * edgeGroups * 4 + i + 1] = attrPoint[i + 1]

                    plotsDefNormal[defL * edgeGroups * 4 + i] = attrNormal[i] * attrMiter[j] * width
                    plotsDefNormal[defL * edgeGroups * 4 + i + 1] =
                        attrNormal[i + 1] * attrMiter[j] * width
                }
                defL++
                def.push({ color: colorFloat, width, hasArrow })
            }
            // 直线
            else {
                for (let i = 0, j = 0; i < attrPoint.length; i += 2, j += 1) {
                    plotsTwoPoint[twoL * twoGroup * 4 + i] = attrPoint[i]
                    plotsTwoPoint[twoL * twoGroup * 4 + i + 1] = attrPoint[i + 1]

                    plotsTwoNormal[twoL * twoGroup * 4 + i] = attrNormal[i] * attrMiter[j] * width
                    plotsTwoNormal[twoL * twoGroup * 4 + i + 1] =
                        attrNormal[i + 1] * attrMiter[j] * width
                }
                twoL++
                two.push({ color: colorFloat, width, hasArrow })
            }
        })

        groups = [...two, ...def]

        groups.forEach((item: any, i: number) => {
            uniformBufferData[alignedUniformFloats * i + 0] = item.color // color
            uniformBufferData[alignedUniformFloats * i + 1] = item.width // width

            bindGroups[i] = device.createBindGroup({
                layout: this.bindGroupLayout as GPUBindGroupLayout,
                entries: [
                    {
                        binding: 0,
                        resource: {
                            buffer: uniformBuffer,
                            offset: i * alignedUniformBytes,
                            size: ATTRIBUTES * Float32Array.BYTES_PER_ELEMENT,
                        },
                    },
                ],
            })
        })

        arrowGroups = [...twoArrow, ...defArrow]

        const arrowNum = arrowGroups.length

        const arrowBindGroups = new Array(arrowNum)
        // 绘制个数
        const numArrows = arrowNum
        // uniform属性
        const uniformArrowBytes = ARROWATTRIBUTES * Float32Array.BYTES_PER_ELEMENT
        const alignedUniformArrowBytes = Math.ceil(uniformArrowBytes / 256) * 256
        const alignedUniformArrowFloats = alignedUniformArrowBytes / Float32Array.BYTES_PER_ELEMENT
        // 创建unifromBuffer
        const uniformArrowBuffer = device.createBuffer({
            size: numArrows * alignedUniformArrowBytes + Float32Array.BYTES_PER_ELEMENT * 16 * 2,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
        })
        const uniformBufferArrowData = new Float32Array(numArrows * alignedUniformArrowFloats)

        arrowGroups.forEach((item: any, i: number) => {
            uniformBufferArrowData[alignedUniformArrowFloats * i + 0] = item.x // x
            uniformBufferArrowData[alignedUniformArrowFloats * i + 1] = item.y // y
            uniformBufferArrowData[alignedUniformArrowFloats * i + 2] = item.angle // angle
            uniformBufferArrowData[alignedUniformArrowFloats * i + 3] = item.sx // sx
            // uniformBufferArrowData[alignedUniformArrowFloats * i + 4] = item.type; // type
            uniformBufferArrowData[alignedUniformArrowFloats * i + 4] = item.width // width
            uniformBufferArrowData[alignedUniformArrowFloats * i + 5] = item.colorFloat // color

            arrowBindGroups[i] = device.createBindGroup({
                layout: this.bindArrowGroupLayout as GPUBindGroupLayout,
                entries: [
                    {
                        binding: 0,
                        resource: {
                            buffer: uniformArrowBuffer,
                            offset: i * alignedUniformArrowBytes,
                            size: ARROWATTRIBUTES * Float32Array.BYTES_PER_ELEMENT,
                        },
                    },
                ],
            })
        })

        const vertexEdgeTwoBuffer = CreateGPUBuffer(device, plotsTwoPoint)

        const vertexEdgeTwoNormalBuffer = CreateGPUBuffer(device, plotsTwoNormal)

        const vertexEdgeDefBuffer = CreateGPUBuffer(device, plotsDefPoint)

        const vertexEdgeDefNormalBuffer = CreateGPUBuffer(device, plotsDefNormal)

        const projection = mat4.perspective(
            mat4.create(),
            glMatrix.toRadian(camera.zoom),
            canvas.width / canvas.height,
            0.1,
            100,
        )
        const view = camera.getViewMatrix()

        const matOffset = numTriangles * alignedUniformBytes
        const uniformMatBindGroup = device.createBindGroup({
            layout: this.matsBindGroupLayout as GPUBindGroupLayout,
            entries: [
                {
                    binding: 0,
                    resource: {
                        buffer: uniformBuffer,
                        offset: matOffset,
                        size: 64 * 2,
                    },
                },
            ],
        })
        const matArrowOffset = numArrows * alignedUniformArrowBytes
        const uniformMatArrowBindGroup = device.createBindGroup({
            layout: this.matsBindArrowGroupLayout as GPUBindGroupLayout,
            entries: [
                {
                    binding: 0,
                    resource: {
                        buffer: uniformArrowBuffer,
                        offset: matArrowOffset,
                        size: 64 * 2,
                    },
                },
            ],
        })

        for (let offset = 0; offset < uniformBufferData.length; offset += this.maxMappingLength) {
            const uploadCount = Math.min(uniformBufferData.length - offset, this.maxMappingLength)

            device.queue.writeBuffer(
                uniformBuffer,
                offset * Float32Array.BYTES_PER_ELEMENT,
                uniformBufferData.buffer,
                uniformBufferData.byteOffset,
                uploadCount * Float32Array.BYTES_PER_ELEMENT,
            )
        }

        device.queue.writeBuffer(uniformBuffer, matOffset, view as ArrayBuffer)
        device.queue.writeBuffer(uniformBuffer, matOffset + 64, projection as ArrayBuffer)

        for (
            let offset = 0;
            offset < uniformBufferArrowData.length;
            offset += this.maxMappingLength
        ) {
            const uploadCount = Math.min(
                uniformBufferArrowData.length - offset,
                this.maxMappingLength,
            )

            device.queue.writeBuffer(
                uniformArrowBuffer,
                offset * Float32Array.BYTES_PER_ELEMENT,
                uniformBufferArrowData.buffer,
                uniformBufferArrowData.byteOffset,
                uploadCount * Float32Array.BYTES_PER_ELEMENT,
            )
        }

        device.queue.writeBuffer(uniformArrowBuffer, matArrowOffset, view as ArrayBuffer)
        device.queue.writeBuffer(uniformArrowBuffer, matArrowOffset + 64, projection as ArrayBuffer)

        let g = 0,
            h = 0
        const vertexBuffer = CreateGPUBuffer(device, arrowVertexData)

        const drawArrow = (h: number) => {
            passEncoder.setPipeline(this.arrowPipeline)
            passEncoder.setVertexBuffer(0, vertexBuffer)
            passEncoder.setBindGroup(1, uniformMatArrowBindGroup)
            const indexData = new Uint32Array([0, 1, 2, 2, 1, 3])
            const indexBuffer = CreateGPUBufferUint(device, indexData)
            passEncoder.setIndexBuffer(indexBuffer, 'uint32')
            passEncoder.setBindGroup(0, arrowBindGroups[h])
            passEncoder.drawIndexed(6, 1)
        }

        const initTwo = () => {
            passEncoder.setPipeline(this.pipeline)
            passEncoder.setBindGroup(1, uniformMatBindGroup)
            passEncoder.setVertexBuffer(0, vertexEdgeTwoBuffer)
            passEncoder.setVertexBuffer(1, vertexEdgeTwoNormalBuffer)
        }

        initTwo()
        let reInit = false
        for (let i = 0; i < plotNum; i++) {
            reInit && initTwo()

            passEncoder.setBindGroup(0, bindGroups[g])
            passEncoder.draw(twoGroup * 2, 1, twoGroup * 2 * i)

            if (groups[g].hasArrow) {
                drawArrow(h)
                h++
                reInit = true
            } else {
                reInit = false
            }
            g++
        }

        const initDef = () => {
            passEncoder.setPipeline(this.pipeline)
            passEncoder.setBindGroup(1, uniformMatBindGroup)
            passEncoder.setVertexBuffer(0, vertexEdgeDefBuffer)
            passEncoder.setVertexBuffer(1, vertexEdgeDefNormalBuffer)
        }

        reInit = false
        initDef()
        for (let i = 0; i < num; i++) {
            reInit && initDef()

            passEncoder.setBindGroup(0, bindGroups[g])
            passEncoder.draw(edgeGroups * 2, 1, edgeGroups * 2 * i)

            if (groups[g].hasArrow) {
                drawArrow(h)
                h++
                reInit = true
            } else {
                reInit = false
            }
            g++
        }
    }
}
