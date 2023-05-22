import { basicData, globalInfo, globalProp } from '../../../initial/globalProp'
import { CreateGPUBuffer } from '../../../utils/webGPUtils'
import { mat4, glMatrix } from 'gl-matrix'
import edgeHaloVert from '../shaders/edge.vert.wgsl'
import edgeHaloFrag from '../shaders/edge.frag.wgsl'
import { coordTransformation, hashNumber, newfloatColor } from '../../../utils'
import { createLineMesh, loopLineMesh } from '../../../utils/edge/initEdge'
import { getbashTypeHash } from '../../../utils/graph/gpu'

const edgeGroups = globalProp.edgeGroups
const twoGroup = 2
const ATTRIBUTES = 2

export default class EdgeHaloGPUProgram {
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
    private uniformMatBindGroup: GPUBindGroup | undefined
    private maxMappingLength: number
    private plotsDefPoint: Float32Array
    private plotsTwoPoint: Float32Array
    private plotsDefNormal: Float32Array
    private plotsTwoNormal: Float32Array
    private uniformBufferData: Float32Array

    private bindGroups: any[]

    constructor(graph: any) {
        this.graph = graph
        this.gpu = graph.gpu
        this.maxMappingLength = (14 * 1024 * 1024) / Float32Array.BYTES_PER_ELEMENT

        this.uniformBufferData = new Float32Array()

        this.plotsDefPoint = new Float32Array()
        this.plotsTwoPoint = new Float32Array()

        this.plotsDefNormal = new Float32Array()
        this.plotsTwoNormal = new Float32Array()

        this.bindGroups = new Array()
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
                    code: edgeHaloVert,
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
                    code: edgeHaloFrag,
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

    recordRenderPass(
        vertexEdgeTwoBuffer: GPUBuffer | null,
        vertexEdgeTwoNormalBuffer: GPUBuffer | null | undefined,
        vertexEdgeDefBuffer: GPUBuffer | null | undefined,
        vertexEdgeDefNormalBuffer: GPUBuffer | null | undefined,
        passEncoder: GPURenderBundleEncoder | GPURenderPassEncoder,
    ) {
        if (!this.pipeline) return

        passEncoder.setPipeline(this.pipeline)

        passEncoder.setBindGroup(1, this.uniformMatBindGroup as GPUBindGroup)

        let g = 0

        let plotNum = this.plotsTwoPoint.length / (twoGroup * 4)

        let num = this.plotsDefPoint.length / (edgeGroups * 4)

        passEncoder.setVertexBuffer(0, vertexEdgeTwoBuffer as GPUBuffer)
        passEncoder.setVertexBuffer(1, vertexEdgeTwoNormalBuffer as GPUBuffer)
        for (let i = 0; i < plotNum; i++) {
            passEncoder.setBindGroup(0, this.bindGroups[g++])
            passEncoder.draw(twoGroup * 2, 1, twoGroup * 2 * i)
        }

        passEncoder.setVertexBuffer(0, vertexEdgeDefBuffer as GPUBuffer)
        passEncoder.setVertexBuffer(1, vertexEdgeDefNormalBuffer as GPUBuffer)
        for (let i = 0; i < num; i++) {
            passEncoder.setBindGroup(0, this.bindGroups[g++])
            passEncoder.draw(edgeGroups * 2, 1, edgeGroups * 2 * i)
        }
    }

    async render(passEncoder: any, opts: any) {
        let { cameraChanged } = opts

        cameraChanged = false

        this.isInit && (await this.initPineLine())

        const graph = this.graph
        const camera = graph.camera
        const graphId = graph.id
        const { device, canvas, format } = this.gpu

        let edgeList = basicData[graphId].edgeList
        const drawEdgeList = new Set()

        this.graph.getEdgeTypeGpu()

        let baseTypeHash = getbashTypeHash(graphId)
   
        for (let [key, value] of edgeList) {
            let attribute = value.getAttribute()
            if (!attribute) continue
            let { isVisible, halo } = attribute,
                source = value.getSource(),
                target = value.getTarget()
            if (!isVisible || typeof source == 'string' || typeof target == 'string') continue
            if (typeof source == 'undefined' || typeof target == 'undefined') continue

            let { num: sourceNumber } = source.value,
                { num: targetNumber } = target.value

            let hash = hashNumber(sourceNumber, targetNumber), //两点之间的hash值
                hashSet = baseTypeHash?.get(hash), //两点之间hash表
                size = hashSet?.num
            if (!size) continue

            let { width } = halo
            if (width && width > 0) {
                drawEdgeList.add(key)
            }
        }

        // 绘制个数
        const numTriangles = drawEdgeList.size

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

        if (!cameraChanged) {
            this.uniformBufferData = new Float32Array(numTriangles * alignedUniformFloats)
            let forwadHashTable: any = new Map()
            let drawLineHaloArray = new Array()
            let num = 0,
                plotNum = 0

            try {
                for (let [key, value] of edgeList) {
                    if (!drawEdgeList.has(key)) continue
                    // 获取点属性
                    let attribute = value.getAttribute()
                    let { halo, type, location } = attribute,
                        source = value.getSource(),
                        target = value.getTarget()
                    if (type == 'basic') {
                        let { attribute: souce_attribute, num: sourceNumber } = source.value,
                            { attribute: target_attribute, num: targetNumber } = target.value

                        let hash = hashNumber(sourceNumber, targetNumber), //两点之间的hash值
                            hashSet = baseTypeHash?.get(hash), //两点之间hash表
                            size = hashSet?.num
                        let lineNumber = [...hashSet.total].indexOf(key)

                        if (globalInfo[graphId].enabledNoStraightLine) {
                            size == 1 && size++
                            size % 2 !== 0 && lineNumber++
                        }

                        let forwardSource = forwadHashTable?.get(hash)?.sourceNumber,
                            forward =
                                lineNumber == 0
                                    ? 1
                                    : size % 2 == 0
                                    ? lineNumber % 2 == 1 && sourceNumber != forwardSource
                                        ? -1
                                        : 1
                                    : lineNumber % 2 == 0 && sourceNumber != forwardSource
                                    ? -1
                                    : 1,
                            { x: targetX, y: targetY, radius: targetSize } = target_attribute,
                            { x: sourceX, y: sourceY, radius: sourceSize } = souce_attribute
                        let xyOffect = coordTransformation(graphId, sourceX, sourceY),
                            xyOffect2 = coordTransformation(graphId, targetX, targetY),
                            line
                        ;(sourceX = xyOffect[0]),
                            (sourceY = xyOffect[1]),
                            (targetX = xyOffect2[0]),
                            (targetY = xyOffect2[1])
                        halo.location = location
                        forwadHashTable?.set(hash, { sourceNumber, targetNumber })

                        if (source != target) {
                            size > 1 && size % 2 == 0 && lineNumber++
                            line = createLineMesh(
                                size,
                                sourceX,
                                sourceY,
                                targetX,
                                targetY,
                                lineNumber,
                                halo,
                                targetSize,
                                'circle',
                                forward,
                            )
                        } else {
                            line = loopLineMesh(
                                'webgl',
                                sourceX,
                                sourceY,
                                lineNumber,
                                100,
                                halo,
                                sourceSize,
                            )
                        }
                        if (line.bezierNumber == twoGroup) plotNum++
                        else num++

                        drawLineHaloArray.push({
                            ...line.points,
                            edgeGroup: line.bezierNumber,
                            id: key,
                        })
                    }
                }
            } catch {}

            this.plotsDefPoint = new Float32Array(num * edgeGroups * 4)
            this.plotsTwoPoint = new Float32Array(plotNum * twoGroup * 4)

            this.plotsDefNormal = new Float32Array(num * edgeGroups * 4)
            this.plotsTwoNormal = new Float32Array(plotNum * twoGroup * 4)

            let defL = 0,
                twoL = 0

            this.bindGroups = new Array(numTriangles)

            let groups = new Array(),
                def = new Array(),
                two = new Array()

            // to do 提取到@computer中
            drawLineHaloArray.forEach(item => {
                let id = item.id
                let edgeGroup = item.edgeGroup

                let { attrNormal, width, attrMiter, points: attrPoint } = item
                let color = edgeList.get(id)?.getAttribute('halo.color') || '#eee'
                let colorFloat = newfloatColor(color)
                width /= 2
                // 曲线
                if (edgeGroup == edgeGroups) {
                    for (let i = 0, j = 0; i < attrPoint.length; i += 2, j += 1) {
                        this.plotsDefPoint[defL * edgeGroups * 4 + i] = attrPoint[i]
                        this.plotsDefPoint[defL * edgeGroups * 4 + i + 1] = attrPoint[i + 1]

                        this.plotsDefNormal[defL * edgeGroups * 4 + i] =
                            attrNormal[i] * attrMiter[j] * width
                        this.plotsDefNormal[defL * edgeGroups * 4 + i + 1] =
                            attrNormal[i + 1] * attrMiter[j] * width
                    }
                    defL++
                    def.push({ color: colorFloat, width })
                }
                // 直线
                else {
                    for (let i = 0, j = 0; i < attrPoint.length; i += 2, j += 1) {
                        this.plotsTwoPoint[twoL * twoGroup * 4 + i] = attrPoint[i]
                        this.plotsTwoPoint[twoL * twoGroup * 4 + i + 1] = attrPoint[i + 1]

                        this.plotsTwoNormal[twoL * twoGroup * 4 + i] =
                            attrNormal[i] * attrMiter[j] * width
                        this.plotsTwoNormal[twoL * twoGroup * 4 + i + 1] =
                            attrNormal[i + 1] * attrMiter[j] * width
                    }
                    twoL++
                    two.push({ color: colorFloat, width })
                }
            })

            groups = [...two, ...def]

            groups.forEach((item: any, i: number) => {
                this.uniformBufferData[alignedUniformFloats * i + 0] = item.color // color
                this.uniformBufferData[alignedUniformFloats * i + 1] = item.width // width

                this.bindGroups[i] = device.createBindGroup({
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

            for (
                let offset = 0;
                offset < this.uniformBufferData.length;
                offset += this.maxMappingLength
            ) {
                const uploadCount = Math.min(
                    this.uniformBufferData.length - offset,
                    this.maxMappingLength,
                )

                device.queue.writeBuffer(
                    uniformBuffer,
                    offset * Float32Array.BYTES_PER_ELEMENT,
                    this.uniformBufferData.buffer,
                    this.uniformBufferData.byteOffset,
                    uploadCount * Float32Array.BYTES_PER_ELEMENT,
                )
            }
        }

        const vertexEdgeTwoBuffer = CreateGPUBuffer(device, this.plotsTwoPoint)

        const vertexEdgeTwoNormalBuffer = CreateGPUBuffer(device, this.plotsTwoNormal)

        const vertexEdgeDefBuffer = CreateGPUBuffer(device, this.plotsDefPoint)

        const vertexEdgeDefNormalBuffer = CreateGPUBuffer(device, this.plotsDefNormal)

        const projection = mat4.perspective(
            mat4.create(),
            glMatrix.toRadian(camera.zoom),
            canvas.width / canvas.height,
            0.1,
            100,
        )
        const view = camera.getViewMatrix()

        const matOffset = numTriangles * alignedUniformBytes
        this.uniformMatBindGroup = device.createBindGroup({
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

        device.queue.writeBuffer(uniformBuffer, matOffset, view as ArrayBuffer)
        device.queue.writeBuffer(uniformBuffer, matOffset + 64, projection as ArrayBuffer)

        const renderBundleEncoder = device.createRenderBundleEncoder({
            colorFormats: [format],
        })

        this.recordRenderPass(
            vertexEdgeTwoBuffer,
            vertexEdgeTwoNormalBuffer,
            vertexEdgeDefBuffer,
            vertexEdgeDefNormalBuffer,
            renderBundleEncoder,
        )

        const renderBundle = renderBundleEncoder.finish()

        passEncoder.executeBundles([renderBundle])
    }
}
