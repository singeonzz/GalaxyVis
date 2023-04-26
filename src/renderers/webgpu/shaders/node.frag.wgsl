// 圆形
fn sdCircle(p: vec2<f32>, r: f32) -> f32 {
    return length(p) - r;
}

struct inPut {
    @location(0) vCoord: vec2<f32>,
    @location(1) vColor: vec4<f32>,
    @location(2) vStrokeWidth: f32,
    @location(3) vStrokeColor: vec4<f32>
}

@fragment
fn frag_main(
    in: inPut
) -> @location(0) vec4<f32> {
    let coord = in.vCoord;
    let d = sdCircle(vec2(.5) - coord, 0.45);
    let distance = distance(coord, vec2(.5));
    let fwdis = fwidth(distance);

    var col = in.vColor;
    var a_strokeWidth = in.vStrokeWidth;
    var stroke = in.vStrokeColor;

    var outLine = vec4(1.0);
    var backgroundColor = vec4(1.0);

    col = mix(backgroundColor, col, 1.0);

    if 0.0 != a_strokeWidth {
        col = mix(col, outLine, 1.0 - smoothstep(a_strokeWidth + 0.03, a_strokeWidth + 0.03 + fwdis, abs(d)));
        col = mix(col, stroke, 1.0 - smoothstep(a_strokeWidth, fwdis + a_strokeWidth, abs(d)));
    }

    col = mix(col, stroke, 1.0 - smoothstep(0.0, fwdis, abs(d)));

    if sign(d) > 0.0 {
        col = col - sign(d) * vec4(vec3(.0), 1.0);
    }

    if 0.0 != a_strokeWidth {
        col = mix( col, stroke, 1.0-smoothstep(0.0,fwdis,abs(d)) );
    }

    return col;
}