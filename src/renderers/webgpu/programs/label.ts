export default class LabelGPUProgram {
    private gpu: {
        device: GPUDevice
        canvas: HTMLCanvasElement
        format: GPUTextureFormat
        context: any
    }

    private graph: any
    
    constructor(graph: any) {
        this.graph = graph
        this.gpu = graph.gpu
    }

    render(passEncoder: any) {
        
    }
}
