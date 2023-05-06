import labelVert from '../shaders/label.vert.wgsl'
import labelFrag from '../shaders/label.frag.wgsl'
import { globalProp } from '../../../initial/globalProp'
import { isInSceen } from '../../../utils'
import { CreateGPUBuffer, CreateGPUBufferUint } from '../../../utils/webGPUtils'
import { getGPULabelTexture, sdfDrawGPULable } from '../../../utils/tinySdf/sdfDrawText'
import { mat4, glMatrix } from 'gl-matrix'

const ATTRIBUTES = 15
const SDFATTRIBUTES = 2

export default class LabelGPUProgram {
    private gpu: {
        device: GPUDevice
        canvas: HTMLCanvasElement
        format: GPUTextureFormat
        context: any
    }

    private graph: any
    private maxMappingLength: number
    private bindGroupLayout: GPUBindGroupLayout | undefined
    private matsBindGroupLayout: GPUBindGroupLayout | undefined
    private pipeline: GPURenderPipeline | undefined
    private isInit = true

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
                        minBindingSize: 64 * 2 + SDFATTRIBUTES * 8,
                    },
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.FRAGMENT,
                    sampler: {},
                },
                {
                    binding: 2,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: {
                        sampleType: 'float',
                        viewDimension: '2d',
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
                    code: labelVert,
                }),
                entryPoint: 'vert_main',
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
                    code: labelFrag,
                }),
                entryPoint: 'frag_main',
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
        this.pipeline = device.createRenderPipeline({
            ...pipelineDesc,
            layout: pipelineLayout,
        })

        this.isInit = false
    }

    async render(passEncoder: any) {
        this.isInit && (await this.initPineLine())

        const graph = this.graph

        const graphId = graph.id

        const camera = graph.camera
        const scale = globalProp.globalScale / camera.ratio

        const { device, canvas } = this.gpu

        let ts = await getGPULabelTexture(device)

        if (!ts) return

        const vertexData = new Float32Array([
            -1, -1, 0, 0, 
            1, -1, 1, 0, 
            -1, 1, 0, 1, 
            1, 1, 1, 1
        ])

        const vertexBuffer = CreateGPUBuffer(device, vertexData)
        const nodes = this.graph.getNodes()

        const LabelsMap = new Map()
        let labelLength = 0
        nodes.forEach((item: any) => {
            let attribute = item.getAttribute()
            let id = item.getId()
            let text = attribute.text
            let content = text.content
            if (
                !(content == '' || content == null || content == undefined) &&
                text.minVisibleSize < Math.ceil(text.fontSize * scale * 1e2) / 1e2 &&
                (this.graph.geo.enabled() ||
                    isInSceen(graphId, 'webgl', camera.ratio, camera.position, attribute, 1))
            ) {
                LabelsMap.set(id, item)
                labelLength += content.length
            }
        })

        // 绘制个数
        const numTriangles = labelLength
        if (!numTriangles) return

        // uniform属性
        const uniformBytes = ATTRIBUTES * Float32Array.BYTES_PER_ELEMENT
        const alignedUniformBytes = Math.ceil(uniformBytes / 256) * 256
        const alignedUniformFloats = alignedUniformBytes / Float32Array.BYTES_PER_ELEMENT
        // 创建unifromBuffer
        const uniformBuffer = device.createBuffer({
            size: 
                numTriangles * alignedUniformBytes + 
                Float32Array.BYTES_PER_ELEMENT * 16 * 2 +
                Float32Array.BYTES_PER_ELEMENT * 2 * SDFATTRIBUTES,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
        })

        // 创建Data
        const uniformBufferData = new Float32Array(numTriangles * alignedUniformFloats)

        const bindGroups = new Array(numTriangles)

        let nodeLabelIndex = 0,
            floatArrayLength = 0

        LabelsMap.forEach((item: any, key: string) => {
            const attribute = item.getAttribute()
            let p = sdfDrawGPULable(graphId, attribute, 0, 1, alignedUniformFloats)
            uniformBufferData.set(p, floatArrayLength)
            floatArrayLength += p.length

            let text = attribute.text
            let content = text.content
            
            for (let i = 0; i < content.length; i++) {
                bindGroups[nodeLabelIndex + i] = device.createBindGroup({
                    layout: this.bindGroupLayout as GPUBindGroupLayout,
                    entries: [
                        {
                            binding: 0,
                            resource: {
                                buffer: uniformBuffer,
                                offset: (nodeLabelIndex + i) * alignedUniformBytes,
                                size: ATTRIBUTES * Float32Array.BYTES_PER_ELEMENT,
                            },
                        },
                    ],
                })
            }
            nodeLabelIndex += content.length
        })

        const projection = mat4.perspective(
            mat4.create(),
            glMatrix.toRadian(camera.zoom),
            canvas.width / canvas.height,
            0.1,
            100,
        )
        const view = camera.getViewMatrix()

        const atlas = graph.fast ? 8 : globalProp.atlas

        let gammer = camera.zoom / 75

        const SDFUnity = new Float32Array([atlas * 64, gammer]);

        const matOffset = numTriangles * alignedUniformBytes
        const uniformMatBindGroup = device.createBindGroup({
            layout: this.matsBindGroupLayout as GPUBindGroupLayout,
            entries: [
                {
                    binding: 0,
                    resource: {
                        buffer: uniformBuffer,
                        offset: matOffset,
                        size: 64 * 2 + 8 * SDFATTRIBUTES,
                    },
                },
                {
                    binding: 1,
                    resource: ts.sampler,
                },
                {
                    binding: 2,
                    resource: ts.texture.createView(),
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
        device.queue.writeBuffer(uniformBuffer, matOffset + 128, SDFUnity)

        passEncoder.setVertexBuffer(0, vertexBuffer)

        passEncoder.setBindGroup(1, uniformMatBindGroup)

        const indexData = new Uint32Array([0, 1, 2, 2, 1, 3])
        const indexBuffer = CreateGPUBufferUint(device, indexData)
        passEncoder.setIndexBuffer(indexBuffer, 'uint32')

        for (let i = 0; i < numTriangles; ++i) {
            passEncoder.setBindGroup(0, bindGroups[i])

            passEncoder.drawIndexed(6, 1)
        }
    }
}
