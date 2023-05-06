const unit32:u32 = 0xFF000000u;
const unit24:u32 = 0x00FF0000u;
const unit16:u32 = 0x0000FF00u;
const unit8:u32 = 0x000000FFu;

// 属性attributes
struct Uniforms {
        // ver_mat_x: vec3<f32>,
        // ver_mat_y: vec3<f32>,

        // tex_mat_x: vec3<f32>,
        // tex_mat_y: vec3<f32>,
        mat11: f32,
        mat21: f32,
        mat41: f32,
        mat12: f32,
        mat22: f32,
        mat42: f32,

        texmat11: f32,
        texmat21: f32,
        texmat41: f32,
        texmat12: f32,
        texmat22: f32,
        texmat42: f32,

        color: u32,
        bg_color: u32,
        opacity: f32
    };
@binding(0) @group(0) var<uniform> uniforms: Uniforms;

// 投影矩阵，透视矩阵
struct Mats {   
        aXformMatrix: mat4x4<f32>,
        projection: mat4x4<f32>,              

        texSize: f32,
        gammer: f32,       
    };
@binding(0) @group(1) var<uniform> mats: Mats;

struct outPut {
    @builtin(position) Position: vec4<f32>,
    @location(0) vcolor: vec4<f32>,
    @location(1) bgcolor: vec4<f32>,
    @location(2) texcoord: vec2<f32>,
    @location(3) opacity: f32,
    @location(4) gammer: f32,
    @location(5) texSize: f32,
}

@vertex
fn vert_main(
    @location(0) position: vec4<f32>,
    @location(1) coord: vec2<f32>,
) -> outPut {
    var output: outPut;

    var xpos = position.x * uniforms.mat11 + position.y * uniforms.mat21 + uniforms.mat41;
    var ypos = position.x * uniforms.mat12 + position.y * uniforms.mat22 + uniforms.mat42;
    output.Position = mats.projection * mats.aXformMatrix * vec4(xpos, ypos, 0.0, 1.0);

    var vTex:vec2<f32>;
    vTex.x = coord.x * uniforms.texmat11 + coord.y * uniforms.texmat21 + uniforms.texmat41;
    vTex.y = coord.x * uniforms.texmat12 + coord.y * uniforms.texmat22 + uniforms.texmat42;

    output.texcoord = vTex;

    // 解压文字颜色
    var packedColor: u32 = uniforms.color;
    var fa: f32 = f32((packedColor & unit32) >> 24u) / 255.0;
    var fb: f32 = f32((packedColor & unit24) >> 16u) / 255.0;
    var fg: f32 = f32((packedColor & unit16) >> 8u) / 255.0;
    var fr: f32 = f32(packedColor & unit8) / 255.0;
    output.vcolor = vec4<f32>(fr, fg, fb, fa);

    // 解压背景颜色
    var packedbgColor: u32 = uniforms.bg_color;
    var ba: f32 = f32((packedbgColor & unit32) >> 24u) / 255.0;
    var bb: f32 = f32((packedbgColor & unit24) >> 16u) / 255.0;
    var bg: f32 = f32((packedbgColor & unit16) >> 8u) / 255.0;
    var br: f32 = f32(packedbgColor & unit8) / 255.0;
    output.bgcolor = vec4<f32>(br, bg, bb, ba);

    output.opacity = uniforms.opacity;
    output.gammer = mats.gammer;
    output.texSize = mats.texSize;

    return output;
}