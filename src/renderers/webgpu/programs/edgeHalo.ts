import { basicData, globalInfo, globalProp } from '../../../initial/globalProp'
import { CreateGPUBuffer } from '../../../utils/webGPUtils'
import { mat4, glMatrix } from 'gl-matrix'
import edgeHaloVert from '../shaders/edge.vert.wgsl'
import edgeHaloFrag from '../shaders/edge.frag.wgsl'
import { coordTransformation, hashNumber, newfloatColor } from '../../../utils'
import { createLineMesh, loopLineMesh } from '../../../utils/edge/initEdge'

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
    private maxMappingLength: number

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

    async render(passEncoder: any) {

        this.isInit && (await this.initPineLine())

        const graph = this.graph
        const camera = graph.camera
        const graphId = graph.id
        const { device, canvas } = this.gpu

        let edgeList = basicData[graphId].edgeList
        
        let baseTypeHash = this.graph.getEdgeType().baseTypeHash
        let forwadHashTable: any = new Map()
        let num = 0, plotNum = 0;
        let drawLineHaloArray = new Array();

        try {
            for (let [key, value] of edgeList) {
                // 获取点属性
                let attribute = value.getAttribute()
                if (!attribute) continue
                let { isVisible, halo, type, opacity, location } = attribute,
                    source = value.getSource(),
                    target = value.getTarget()

                // 如果被隐藏则跳过
                if (!isVisible || typeof source == 'string' || typeof target == 'string') continue
                if (typeof source == 'undefined' || typeof target == 'undefined') continue
                let { attribute: souce_attribute, num: sourceNumber } = source.value,
                    { attribute: target_attribute, num: targetNumber } = target.value
                if (type == 'basic') {
                    let hash = hashNumber(sourceNumber, targetNumber), //两点之间的hash值
                        hashSet = baseTypeHash?.get(hash), //两点之间hash表
                        size = hashSet?.num
                    if (!size) continue

                    let lineNumber = [...hashSet.total].indexOf(key);

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
                        ; (sourceX = xyOffect[0]),
                            (sourceY = xyOffect[1]),
                            (targetX = xyOffect2[0]),
                            (targetY = xyOffect2[1])
                    halo.location = location
                    forwadHashTable?.set(hash, { sourceNumber, targetNumber })
                    // 如果宽度为0则跳过
                    if (halo?.width == 0 || !halo) continue
                    if (source != target) {
                        size > 1 && size % 2 == 0 && lineNumber++
                        line = createLineMesh(
                            2,
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
                    if(line.bezierNumber == twoGroup) plotNum++;
                    else num++;

                    drawLineHaloArray.push({...line.points, edgeGroup:line.bezierNumber, id: key})
                }
            }
        } catch { }

        let plotsDefPoint = new Float32Array(num * edgeGroups * 4)
        let plotsTwoPoint = new Float32Array(plotNum * twoGroup * 4)

        let plotsDefNormal = new Float32Array(num * edgeGroups * 4)
        let plotsTwoNormal = new Float32Array(plotNum * twoGroup * 4)

        let defL = 0,
            twoL = 0

        const bindGroups = new Array(num + plotNum)
        // 绘制个数
        const numTriangles = num + plotNum

        if(!numTriangles) return;

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

        // to do 提取到@computer中
        drawLineHaloArray.forEach((item) => {
            let id =  item.id
            let edgeGroup = item.edgeGroup

            let { attrNormal, width, attrMiter, points: attrPoint } = item
            let color = edgeList.get(id)?.getAttribute("halo.color") || "#eee"
            let colorFloat = newfloatColor(color)
            width /= 2;
            // 曲线
            if (edgeGroup == edgeGroups) {
                for (let i = 0, j = 0; i < attrPoint.length; i += 2, j += 1) {
                    plotsDefPoint[defL * edgeGroups * 4 + i] = attrPoint[i]
                    plotsDefPoint[defL * edgeGroups * 4 + i + 1] = attrPoint[i + 1]

                    plotsDefNormal[defL * edgeGroups * 4 + i] = attrNormal[i] * attrMiter[j] * width
                    plotsDefNormal[defL * edgeGroups * 4 + i + 1] = attrNormal[i + 1] * attrMiter[j] * width 
                }
                defL++
                def.push({ color: colorFloat, width })
            }
            // 直线
            else {
                for (let i = 0, j = 0; i < attrPoint.length; i += 2, j += 1) {
                    plotsTwoPoint[twoL * twoGroup * 4 + i] = attrPoint[i]
                    plotsTwoPoint[twoL * twoGroup * 4 + i + 1] = attrPoint[i + 1]

                    plotsTwoNormal[twoL * twoGroup * 4 + i] = attrNormal[i] * attrMiter[j] * width
                    plotsTwoNormal[twoL * twoGroup * 4 + i + 1] = attrNormal[i + 1] * attrMiter[j] * width
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

        let g = 0
        passEncoder.setVertexBuffer(0, vertexEdgeTwoBuffer)
        passEncoder.setVertexBuffer(1, vertexEdgeTwoNormalBuffer)
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
