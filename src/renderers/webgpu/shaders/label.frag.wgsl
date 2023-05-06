const SDF_PX = 8.0;
const DEVICE_PIXEL_RATIO = 2.0;
const EDGE_GAMMA = 0.105 / DEVICE_PIXEL_RATIO;
const UBUFFER = .76;
// 纹理属性
@binding(1) @group(1) var textureSampler: sampler;
@binding(2) @group(1) var textureData: texture_2d<f32>;

struct inPut {
    @location(0) vcolor: vec4<f32>,
    @location(1) bgcolor: vec4<f32>,
    @location(2) texcoord: vec2<f32>,
    @location(3) opacity: f32,
    @location(4) gammer: f32,
    @location(5) texSize: f32,
}

fn AntiAliasPointSampleTexture_ModifiedFractal(uv:vec2<f32>, texsize: vec2<f32>) 
-> vec4<f32> {     
    var iuv = uv; 
    iuv -= 0.5;  
    var w = fwidth(iuv);  
    var coord = (floor(iuv)+0.5+min(fract(iuv)/min(w,vec2<f32>(1.0)), vec2<f32>(1.0))) / texsize;
    return textureSample(textureData, textureSampler, coord, vec2<i32>(-1));  
} 

@fragment
fn frag_main(
    in: inPut
) -> @location(0) vec4<f32> {

    // 获取纹理
    // let textureColor: vec4<f32> = (textureSample(textureData, textureSampler, in.texcoord));
    let textureColor:vec4<f32> = AntiAliasPointSampleTexture_ModifiedFractal( in.texcoord, vec2(in.texSize));

    var dist = textureColor.r;
    var gamma = (in.gammer * 1.19 / SDF_PX + EDGE_GAMMA) ;
    var alpha = smoothstep(UBUFFER - gamma, UBUFFER + gamma, dist);

    var labelColor: vec4<f32>;
    if in.bgcolor.a > 0. {
        var realBColor = mix(in.bgcolor, in.vcolor, alpha);

        labelColor = mix(in.bgcolor, realBColor, in.opacity);
    } else {
        var RealvColor = mix(in.bgcolor, in.vcolor, in.opacity);

        labelColor = vec4(RealvColor.rgb, alpha);
    }
    return labelColor;
    // return textureColor;
    // return vec4(1.0,0.0,0.0,1.0);
}