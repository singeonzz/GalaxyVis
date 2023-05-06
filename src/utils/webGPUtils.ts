import { globalProp } from "../initial/globalProp";

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
        alphaMode: "premultiplied",
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

/**
 * 创建GPUBuffer u32
 * @param device 
 * @param data 
 * @param usageFlag 
 * @returns 
 */
export const CreateGPUBufferUint = (
    device: GPUDevice, 
    data: Uint32Array, 
    usageFlag = GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST) => {
    const buffer = device.createBuffer({
        size: data.byteLength,
        usage: usageFlag,
        mappedAtCreation: true
    });
    new Uint32Array(buffer.getMappedRange()).set(data);
    buffer.unmap();
    return buffer;
};

/**
 * 加载纹理
 * @param device 
 * @param imageName 
 * @param addressModeU 
 * @param addressModeV 
 * @returns 
 */
export const GetTexture = async(
    device: GPUDevice, 
    htc: HTMLCanvasElement,
    flipY = true,
    addressModeU = 'repeat',
    addressModeV = 'repeat',
) => {
    const imageBitmap = await createImageBitmap(htc);

    // 创建GPUSampler,它控制着着色器如何转换和过滤纹理资源数据
    const sampler = device.createSampler({
        minFilter: 'linear',
        magFilter: 'linear',
        addressModeU: addressModeU as GPUAddressMode,
        addressModeV: addressModeV as GPUAddressMode
    });       

    // 创建纹理
    const texture = device.createTexture({
        size: [imageBitmap.width, imageBitmap.height, 1],
        format: 'rgba8unorm',
        usage: GPUTextureUsage.TEXTURE_BINDING | 
               GPUTextureUsage.COPY_DST | 
               GPUTextureUsage.RENDER_ATTACHMENT
    });
    // 将从源图像、视频或画布中获取的快照复制到给定的GPUTexture.
    // 
    device.queue.copyExternalImageToTexture(
        { source: imageBitmap, flipY },
        { texture: texture },
        [imageBitmap.width, imageBitmap.height]
    );

    return {
        texture,
        sampler
    }
}