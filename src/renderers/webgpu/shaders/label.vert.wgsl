const unit32:u32 = 0xFF000000u;
const unit24:u32 = 0x00FF0000u;
const unit16:u32 = 0x0000FF00u;
const unit8:u32 = 0x000000FFu;

// 属性attributes
struct Uniforms {
        color: u32,
    }
@binding(0) @group(0) var<uniform> uniforms: Uniforms;

// 投影矩阵，透视矩阵
struct Mats {   
        aXformMatrix: mat4x4<f32>,
        projection: mat4x4<f32>,                     
    };
@binding(0) @group(1) var<uniform> mats: Mats;

struct outPut {
    @builtin(position) Position: vec4<f32>,
}

@vertex
fn vert_main(
    @location(0) position: vec4<f32>,
    @location(1) coord: vec2<f32>,
) -> outPut {
    var output: outPut;

    return output;
}