struct inPut {
   @location(0) coords: vec3<f32>,
   @location(1) vColor: vec4<f32>,
}

@fragment
fn main(
    in: inPut
) -> @location(0) vec4<f32> {

    var distance = length((in.coords.xy));

    var weight = smoothstep((in.coords.z) - 0.01, in.coords.z, distance);

    var col = mix(vec4(0.0), in.vColor, 1.0 - weight);

    return col;
}