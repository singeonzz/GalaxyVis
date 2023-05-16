import nodeHaloVert from '../shaders/node.halo.vert.wgsl'
import nodeHaloFrag from '../shaders/node.halo.frag.wgsl'
import { CreateGPUBuffer, CreateGPUBufferUint } from '../../../utils/webGPUtils'
import { basicData, globalProp } from '../../../initial/globalProp'
import { coordTransformation, newfloatColor } from '../../../utils'
import { mat4, glMatrix } from 'gl-matrix'
import EdgeHaloGPUProgram from './edgeHalo'

const ATTRIBUTES = 4
const vertexData = new Float32Array([-1, -1, 0, 0, 1, -1, 1, 0, -1, 1, 0, 1, 1, 1, 1, 1])

export default class NodeHaloGPUProgram {
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
    private bindGroups: any[]
    private uniformBufferData: Float32Array
    private edgeHalo: EdgeHaloGPUProgram
    private uniformMatBindGroup: GPUBindGroup | undefined

    constructor(graph: any) {
        this.graph = graph
        this.gpu = graph.gpu
        this.maxMappingLength = (14 * 1024 * 1024) / Float32Array.BYTES_PER_ELEMENT

        this.bindGroups = new Array()

        this.uniformBufferData = new Float32Array()
        this.edgeHalo = new EdgeHaloGPUProgram(this.graph)
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
                    code: nodeHaloVert,
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
                    code: nodeHaloFrag,
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
                                srcFactor: 'one',
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

    recordRenderPass(
        numTriangles: number,
        passEncoder: GPURenderBundleEncoder | GPURenderPassEncoder
    ) {
        if(!this.pipeline) return;

        const { device } = this.gpu
        const vertexBuffer = CreateGPUBuffer(device, vertexData)

        passEncoder.setPipeline(this.pipeline);

        passEncoder.setVertexBuffer(0, vertexBuffer)

        passEncoder.setBindGroup(1, this.uniformMatBindGroup as GPUBindGroup)

        const indexData = new Uint32Array([0, 1, 2, 2, 1, 3])
        const indexBuffer = CreateGPUBufferUint(device, indexData)
        passEncoder.setIndexBuffer(indexBuffer, 'uint32')

        for (let i = 0; i < numTriangles; ++i) {
            passEncoder.setBindGroup(0, this.bindGroups[i])

            passEncoder.drawIndexed(6, 1)
        }
    }

    async render(passEncoder: any, opts: any) {
        await this.edgeHalo.render(passEncoder, opts)

        let { cameraChanged } = opts

        this.isInit && (await this.initPineLine())

        const that = this

        const graph = this.graph

        const graphId = graph.id

        const camera = graph.camera

        const transform = basicData[graphId]?.transform || 223

        const { device, canvas, format } = this.gpu

        const nodes = this.graph.getNodes()

        const drawNodeList: any = new Map()

        // badges;
        nodes.forEach((item: any) => {
            let id = item.getId()
            let { halo } = item.getAttribute()

            let { width } = halo
            if (width && width > 0) {
                drawNodeList.set(id, item)
            }
        })

        // 绘制个数
        const numTriangles = drawNodeList.size

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

        function addUniformData(
            i: number,
            zoomResults: number,
            offsets: number[],
            colorFloat: number,
        ) {
            that.uniformBufferData[alignedUniformFloats * i + 0] = zoomResults // scale
            that.uniformBufferData[alignedUniformFloats * i + 1] = offsets[0] // x
            that.uniformBufferData[alignedUniformFloats * i + 2] = offsets[1] // y
            that.uniformBufferData[alignedUniformFloats * i + 3] = colorFloat // floatColor

            that.bindGroups[i] = device.createBindGroup({
                layout: that.bindGroupLayout as GPUBindGroupLayout,
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
        }

        if (!cameraChanged) {
            this.bindGroups = new Array(numTriangles)
            // 创建Data
            this.uniformBufferData = new Float32Array(numTriangles * alignedUniformFloats)

            let nodeIndex = 0
            drawNodeList.forEach((item: any) => {
                let { x, y, halo, radius } = item.getAttribute()

                let { color, width } = halo

                let haloRadius = Number(radius + width / 2)

                // 真实的r比例
                let zoomResults: number =
                    Math.ceil((haloRadius / globalProp.standardRadius) * 1e2) / 1e3

                let offsets: number[] = coordTransformation(graphId, x, y, transform)

                let colorFloat = newfloatColor(color)

                addUniformData(nodeIndex++, zoomResults, offsets, colorFloat)
            })

            for (let offset = 0; offset < this.uniformBufferData.length; offset += this.maxMappingLength) {
                const uploadCount = Math.min(this.uniformBufferData.length - offset, this.maxMappingLength)
    
                device.queue.writeBuffer(
                    uniformBuffer,
                    offset * Float32Array.BYTES_PER_ELEMENT,
                    this.uniformBufferData.buffer,
                    this.uniformBufferData.byteOffset,
                    uploadCount * Float32Array.BYTES_PER_ELEMENT,
                )
            }
        }

        if(!this.uniformBufferData.length) return;

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
          });

        this.recordRenderPass(numTriangles, renderBundleEncoder);

        const renderBundle = renderBundleEncoder.finish();

        passEncoder.executeBundles([renderBundle]);


 
    }
}
