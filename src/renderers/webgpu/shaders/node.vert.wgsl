const unit32:u32 = 0xFF000000u;
const unit24:u32 = 0x00FF0000u;
const unit16:u32 = 0x0000FF00u;
const unit8:u32 = 0x000000FFu;

// 属性attributes
struct Uniforms {
        scale: f32,
        offsetX: f32,
        offsetY: f32,
        color: u32,
        strokeWidth: f32,
        strokeColor: u32,
        iconType: f32,
        uvx:f32,
        uvy:f32,
    }
@binding(0) @group(0) var<uniform> uniforms: Uniforms;

// 投影矩阵，透视矩阵
struct Mats {   
        aXformMatrix: mat4x4<f32>,
        projection: mat4x4<f32>,                     
    };
@binding(0) @group(1) var<uniform> mats: Mats;

// 顶点着色器出参 类似于glsl中的varying
struct outPut {
    @builtin(position) Position: vec4<f32>,
    @location(0) vCoord: vec2<f32>,
    @location(1) vColor: vec4<f32>,
    @location(2) vStrokeWidth: f32,
    @location(3) vStrokeColor: vec4<f32>,
    @location(4) vUV: vec2<f32>,
    @location(5) uIconType: f32
}

// 顶点着色器入口
@vertex
fn vert_main(
    @location(0) position: vec4<f32>,
    @location(1) coord: vec2<f32>,
) -> outPut {
    // 坐标计算
    var xpos = position.x * uniforms.scale;
    var ypos = position.y * uniforms.scale;

    xpos = xpos + uniforms.offsetX;
    ypos = ypos + uniforms.offsetY;

    var output: outPut;
    // 将顶点数据写入片元着色器
    output.vCoord = coord;
    output.Position = mats.projection * mats.aXformMatrix * vec4(xpos, ypos, 0.0, 1.0);
    
    // 解压主体颜色
    var packedColor: u32 = uniforms.color;
    var ma: f32 = f32((packedColor & unit32) >> 24u) / 255.0;
    var mb: f32 = f32((packedColor & unit24) >> 16u) / 255.0;
    var mg: f32 = f32((packedColor & unit16) >> 8u) / 255.0;
    var mr: f32 = f32(packedColor & unit8) / 255.0;
    output.vColor = vec4<f32>(mr, mg, mb, ma);

    // 解压外环颜色
    var stColor: u32 = uniforms.strokeColor;
    var sa: f32 = f32((stColor & unit32) >> 24u) / 255.0;
    var sb: f32 = f32((stColor & unit24) >> 16u) / 255.0;
    var sg: f32 = f32((stColor & unit16) >> 8u) / 255.0;
    var sr: f32 = f32(stColor & unit8) / 255.0;
    output.vStrokeColor = vec4<f32>(sr, sg, sb, sa);

    output.vStrokeWidth = uniforms.strokeWidth;

    output.uIconType = uniforms.iconType;
    // output.vUV = coord;
    output.vUV = coord /32. + vec2(uniforms.uvx, uniforms.uvy);

    return output;
}