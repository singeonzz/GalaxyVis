import nodeVert from '../shaders/node.vert.wgsl'
import nodeFrag from '../shaders/node.frag.wgsl'
import { CreateGPUBuffer, CreateGPUBufferUint } from '../../../utils/webGPUtils'
import { basicData, globalProp } from '../../../initial/globalProp'
import { coordTransformation, newfloatColor } from '../../../utils'
import { mat4, glMatrix } from 'gl-matrix'

const ATTRIBUTES = 10

export default class NodeGPUProgram {
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
    private ts:
        | {
              texture: GPUTexture
              sampler: GPUSampler
          }
        | undefined

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
                    code: nodeVert,
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
                    code: nodeFrag,
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

        this.ts = globalProp.gpuTexture
    }

    async render(passEncoder: any) {
        this.isInit && (await this.initPineLine())

        this.ts = globalProp.gpuTexture

        if (!this.ts) return

        const that = this

        const graph = this.graph

        const graphId = graph.id

        const camera = graph.camera

        const transform = basicData[graphId]?.transform || 223

        const { device, canvas } = this.gpu

        const vertexData = new Float32Array([-1, -1, 0, 0, 1, -1, 1, 0, -1, 1, 0, 1, 1, 1, 1, 1])

        const vertexBuffer = CreateGPUBuffer(device, vertexData)
        const nodes = this.graph.getNodes()

        const drawNodeList: any = new Map()

        // badges;
        nodes.forEach((item: any) => {
            let id = item.getId()
            let badges = item.getAttribute('badges')
            const isBadges = badges ? true : false

            drawNodeList.set(id, {
                badges: isBadges,
            })

            if (isBadges) {
                let badgesArray = Object.keys(badges)
                for (let i = 0; i < badgesArray.length; i++) {
                    drawNodeList.set(`badges_${badgesArray[i]}` + id, {
                        badges: true,
                    })
                }
            }
        })

        // 绘制个数
        const numTriangles = drawNodeList.size || nodes.size

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

        // 创建Data
        const uniformBufferData = new Float32Array(numTriangles * alignedUniformFloats)

        const bindGroups = new Array(numTriangles)

        const atlas = globalProp.atlas
        const iconMap = globalProp.iconMap
        const wid = 128

        function addUniformData(
            i: number,
            zoomResults: number,
            offsets: number[],
            colorFloat: number,
            strokeWidth: number,
            strokeColor: number,
            iconType: number,
            iconColor: number,
            uv_x: number,
            uv_y: number,
        ) {
            uniformBufferData[alignedUniformFloats * i + 0] = zoomResults // scale
            uniformBufferData[alignedUniformFloats * i + 1] = offsets[0] // x
            uniformBufferData[alignedUniformFloats * i + 2] = offsets[1] // y
            uniformBufferData[alignedUniformFloats * i + 3] = colorFloat // floatColor
            uniformBufferData[alignedUniformFloats * i + 4] = strokeWidth // StrokeWidth
            uniformBufferData[alignedUniformFloats * i + 5] = strokeColor // StrokeColor

            uniformBufferData[alignedUniformFloats * i + 6] = iconType // iconType
            uniformBufferData[alignedUniformFloats * i + 7] = iconColor // iconColor

            uniformBufferData[alignedUniformFloats * i + 8] = uv_x // uv_x
            uniformBufferData[alignedUniformFloats * i + 9] = uv_y // uv_y

            bindGroups[i] = device.createBindGroup({
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
        let nodeIndex = 0
        nodes.forEach((item: any) => {
            let id = item.getId();

            let { x, y, radius, color, innerStroke, isSelect, image, icon, badges, shape } =
                item.getAttribute()

            let zoomResults: number = Math.ceil((radius / globalProp.standardRadius) * 1e2) / 1e3

            let offsets: number[] = coordTransformation(graphId, x, y, transform)

            let colorFloat = newfloatColor(color)

            let strokeWidth = (Number(innerStroke?.width) >= 0 ? innerStroke.width : 2) / 1e2

            let iconNum: number = image.url
                ? iconMap.get(image.url + color)?.num
                : iconMap.get(icon.content)?.num

            let iconType = image.url ? 1 : icon.content != '' ? 2 : 3

            if (!iconNum) {
                iconNum = 0
            }
            let iconColor = newfloatColor(icon?.color || '#f00')
            let uv_x = ((wid * iconNum) % (wid * atlas)) / (wid * atlas),
                uv_y = 1 - (wid + wid * Math.floor(iconNum / atlas)) / (wid * atlas)

            let strokeColor
            if (isSelect) {
                strokeColor = newfloatColor(innerStroke?.selectedColor || innerStroke || '#fff')
            } else {
                strokeColor = newfloatColor(innerStroke?.color || innerStroke || '#fff')
            }

            if (graph.textStatus) {
                camera.quad.insert({
                    x: offsets[0],
                    y: offsets[1],
                    height: zoomResults * 2,
                    width: zoomResults * 2,
                    id,
                    isNode: true,
                    shape,
                })
            }

            addUniformData(
                nodeIndex++,
                zoomResults,
                offsets,
                colorFloat,
                strokeWidth,
                strokeColor,
                iconType,
                iconColor,
                uv_x,
                uv_y,
            )

            if (badges) {
                let badgesArray = Object.keys(badges)
                for (let i = 0; i < badgesArray.length; i++) {
                    let {
                        color: badgesColor,
                        scale,
                        text,
                        stroke,
                        image,
                        postion,
                    } = badges[badgesArray[i]]
                    badgesColor =
                        badgesColor == 'inherit'
                            ? colorFloat
                            : badgesColor
                            ? newfloatColor(badgesColor)
                            : newfloatColor('#fff')
                    scale = scale || 0.35
                    let innerWidth = Number(stroke?.width) >= 0 ? stroke.width : 2
                    let zoomResults2 = zoomResults
                    let size = zoomResults2 * scale

                    postion = badgesArray[i] || 'bottomRight'

                    let direction = globalProp.direction

                    let x = offsets[0] + direction[postion][0] * zoomResults * 0.6,
                        y = offsets[1] - direction[postion][1] * zoomResults * 0.6
                    let iconType = image ? 1 : text?.content != '' ? 2 : 3
                    let badgesIconColor = newfloatColor(text?.color || '#f00')
                    let iconNum: number = image
                        ? iconMap.get(image)?.num
                        : iconMap.get(text?.content || '')?.num

                    let uv_x = ((wid * iconNum) % (wid * atlas)) / (wid * atlas),
                        uv_y = 1 - (wid + wid * Math.floor(iconNum / atlas)) / (wid * atlas)

                    addUniformData(
                        nodeIndex++,
                        size,
                        [x,y],
                        badgesColor,
                        innerWidth / 1e2,
                        newfloatColor(stroke?.color || '#fff'),
                        iconType,
                        badgesIconColor,
                        uv_x,
                        uv_y,
                    )
                }
            }
        })

        // console.log(uniformBufferData,"uniformBufferData")

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
                {
                    binding: 1,
                    resource: this.ts.sampler,
                },
                {
                    binding: 2,
                    resource: this.ts.texture.createView(),
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
