// 圆形
fn sdCircle(p: vec2<f32>, r: f32) -> f32 {
    return length(p) - r;
}

struct inPut {
    @location(0) vCoord: vec2<f32>,
    @location(1) vColor: vec4<f32>,
}

@fragment
fn frag_main(
    in: inPut
) -> @location(0) vec4<f32> {
    let coord = in.vCoord;
    let d = sdCircle(vec2(.5) - coord, 0.45);
    let distance = distance(coord, vec2(.5));
    let fwdis = fwidth(distance);
    
    var InteriorColor: vec4<f32> = in.vColor;

    InteriorColor = mix(InteriorColor, vec4(0.0), 1.0 - smoothstep(0.0, fwdis, abs(d)));

    if sign(d) > 0.0 {
        InteriorColor = InteriorColor - sign(d) * vec4(vec3(.0), 1.0);
    }

    return InteriorColor;
}