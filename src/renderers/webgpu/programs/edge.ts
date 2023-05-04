import { basicData, globalProp } from '../../../initial/globalProp'
import { CreateGPUBuffer } from '../../../utils/webGPUtils'
import { mat4, glMatrix } from 'gl-matrix'
import edgeVert from '../shaders/edge.vert.wgsl'
import edgeFrag from '../shaders/edge.frag.wgsl'
import { newfloatColor } from '../../../utils'

const edgeGroups = globalProp.edgeGroups
const twoGroup = 2
const ATTRIBUTES = 2

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
    private bindGroupLayout: GPUBindGroupLayout | undefined
    private maxMappingLength: number

    constructor(graph: any) {
        this.graph = graph
        this.gpu = graph.gpu
        this.maxMappingLength = (14 * 1024 * 1024) / Float32Array.BYTES_PER_ELEMENT
    }

    async render(passEncoder: any) {
        const graph = this.graph
        const camera = graph.camera
        const graphId = graph.id
        const { device, format, canvas } = this.gpu

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

        let groups = new Array(),
            def = new Array(),
            two = new Array()

        // to do 提取到@computer中
        edgeArray.forEach((item: any[]) => {
            let id = item[3]
            let edgeGroup = item[4]

            let boundBox = edgeBoundBox.get(id)
            let { attrNormal, width, attrMiter, points: attrPoint } = boundBox.points
            let color = edgeList.get(id)?.getAttribute("color") || "#eee"
            let colorFloat = newfloatColor(color)
            // 曲线
            if (edgeGroup == edgeGroups) {
                for (let i = 0, j = 0; i < attrPoint.length; i += 2, j += 1) {
                    plotsDefPoint[defL * edgeGroups * 4 + i] = attrPoint[i]
                    plotsDefPoint[defL * edgeGroups * 4 + i + 1] = attrPoint[i + 1]

                    plotsDefNormal[defL * edgeGroups * 4 + i] = attrNormal[i] * attrMiter[j]
                    plotsDefNormal[defL * edgeGroups * 4 + i + 1] = attrNormal[i + 1] * attrMiter[j]
                }
                defL++
                def.push({ color: colorFloat, width })
            }
            // 直线
            else {
                for (let i = 0, j = 0; i < attrPoint.length; i += 2, j += 1) {
                    plotsTwoPoint[twoL * twoGroup * 4 + i] = attrPoint[i]
                    plotsTwoPoint[twoL * twoGroup * 4 + i + 1] = attrPoint[i + 1]

                    plotsTwoNormal[twoL * twoGroup * 4 + i] = attrNormal[i] * attrMiter[j]
                    plotsTwoNormal[twoL * twoGroup * 4 + i + 1] = attrNormal[i + 1] * attrMiter[j]
                }
                twoL++
                two.push({ color: colorFloat,  width })
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

        const vertexEdgeTwoBuffer = CreateGPUBuffer(device, plotsTwoPoint)

        const vertexEdgeTwoNormalBuffer = CreateGPUBuffer(device, plotsTwoNormal)

        const vertexEdgeDefBuffer = CreateGPUBuffer(device, plotsDefPoint)

        const vertexEdgeDefNormalBuffer = CreateGPUBuffer(device, plotsDefNormal)

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

        passEncoder.setPipeline(this.pipeline)

        device.queue.writeBuffer(uniformBuffer, matOffset, view as ArrayBuffer)
        device.queue.writeBuffer(uniformBuffer, matOffset + 64, projection as ArrayBuffer)

        passEncoder.setBindGroup(1, uniformMatBindGroup)

        passEncoder.setVertexBuffer(0, vertexEdgeTwoBuffer)
        passEncoder.setVertexBuffer(1, vertexEdgeTwoNormalBuffer)

        let g = 0

        for (let i = 0; i < plotNum; i++) {
            passEncoder.setBindGroup(0, bindGroups[g++])
            passEncoder.draw(twoGroup * 2, 1, twoGroup * 2 * i)
        }

        // passEncoder.setPipeline(this.pipeline)
        passEncoder.setVertexBuffer(0, vertexEdgeDefBuffer)
        passEncoder.setVertexBuffer(1, vertexEdgeDefNormalBuffer)
        for (let i = 0; i < num; i++) {
            passEncoder.setBindGroup(0, bindGroups[g++])
            passEncoder.draw(edgeGroups * 2, 1, edgeGroups * 2 * i)
        }
    }
}
