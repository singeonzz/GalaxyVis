// 纹理属性
@binding(1) @group(1) var textureSampler: sampler;
@binding(2) @group(1) var textureData: texture_2d<f32>;

// 圆形
fn sdCircle(p: vec2<f32>, r: f32) -> f32 {
    return length(p) - r;
}

struct inPut {
    @location(0) vCoord: vec2<f32>,
    @location(1) vColor: vec4<f32>,
    @location(2) vStrokeWidth: f32,
    @location(3) vStrokeColor: vec4<f32>,

    @location(4) vUV: vec2<f32>,
    @location(5) uIconType: f32
}

@fragment
fn frag_main(
    in: inPut
) -> @location(0) vec4<f32> {
    let coord = in.vCoord;
    let d = sdCircle(vec2(.5) - coord, 0.45);
    let distance = distance(coord, vec2(.5));
    let fwdis = fwidth(distance);
    let col = in.vColor;

    var shape = u32(floor(in.uIconType+0.5));

    var a_strokeWidth = in.vStrokeWidth;
    var stroke = in.vStrokeColor;

    // 获取纹理
    let textureColor: vec4<f32> = (textureSample(textureData, textureSampler, in.vUV));

    var InteriorColor: vec4<f32>;


    if shape == 1u {
            // image 
        if textureColor.a > 0.0 {
            InteriorColor = textureColor;
        } else {
            InteriorColor = col;
        }
    } else if shape == 2u {
            // icon 
        let alpha = smoothstep(0., .9, textureColor.a);
        InteriorColor = mix(col, vec4(1.0), alpha);
    } else {
        InteriorColor = col;
    }

    var outLine = vec4(1.0);
    var backgroundColor = vec4(1.0);

    InteriorColor = mix(backgroundColor, InteriorColor, 1.0);

    if 0.0 != a_strokeWidth {
        InteriorColor = mix(InteriorColor, outLine, 1.0 - smoothstep(a_strokeWidth + 0.03, a_strokeWidth + 0.03 + fwdis, abs(d)));
        InteriorColor = mix(InteriorColor, stroke, 1.0 - smoothstep(a_strokeWidth, fwdis + a_strokeWidth, abs(d)));
    }

    InteriorColor = mix(InteriorColor, stroke, 1.0 - smoothstep(0.0, fwdis, abs(d)));

    if sign(d) > 0.0 {
        InteriorColor = InteriorColor - sign(d) * vec4(vec3(.0), 1.0);
    }

    if 0.0 != a_strokeWidth {
        InteriorColor = mix(InteriorColor, stroke, 1.0 - smoothstep(0.0, fwdis, abs(d)));
    }

    return InteriorColor;
}