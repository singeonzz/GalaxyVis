/**
 * 初始化WebGPU
 * @returns
 */
export const InitGPU = async (
    canvas: HTMLCanvasElement
) => {
    // 获取device
    // adapter是指物理GPU 一个GPUAdapter 封装了一个显卡适配器，并描述其能力（特性和限制）
    // device是指逻辑GPU 设备是显卡适配器的逻辑实例，内部对象通过设备被创建
    const adapter = await navigator.gpu?.requestAdapter();
    const device = (await adapter?.requestDevice()) as GPUDevice;
    // 获取webgpu的上下文
    const context = canvas.getContext("webgpu") as any;
    const format = navigator.gpu.getPreferredCanvasFormat();
    context.configure({
        device: device,
        format: format,
        // alphaMode设置的是 Canvas 和 HTML 元素背景的混合方式。
        // 如果设置为’opaque’，则用 WebGPU 绘图内容完全覆盖。
        // 也可以为alphaMode 设置为 ‘premultiplied’ （相当于alpha预乘），
        // 在这种情况下，作为 WebGPU 绘图的结果，如果画布像素的 alpha 小于 1，
        // 则该像素将是画布和 HTML 元素背景混合的颜色。
        alphaMode: "opaque",
    });
    return { device, canvas, format, context };
};

/**
 * 核实是否存在WebGPU。
 * @returns
 */
export const CheckWebGPU = () => {
    let result = "Great, your current browser supports WebGPU!";
    let flag = true;
    if (!navigator.gpu) {
        result = `Your current browser does not support WebGPU!`;
        flag = false
    }
    console.log(result)

    return flag;
};

/**
 * 创建GPUBuffer f32
 * @param device
 * @param data
 * @param usageFlag
 * @returns
 */
export const CreateGPUBuffer = (
    device: GPUDevice,
    data: Float32Array,
    usageFlag = GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
) => {
    const buffer = device.createBuffer({
        size: data.byteLength,
        // 代表的允许的按位标志
        usage: usageFlag,
        // 如果为true，可以通过调用立即设置缓冲区内的值GPUBuffer.getMappedRange()
        // 默认值为false
        mappedAtCreation: true,
    });
    new Float32Array(buffer.getMappedRange()).set(data);
    buffer.unmap();
    return buffer;
};