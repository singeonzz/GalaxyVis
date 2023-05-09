struct inPut {
   @location(0) coords: vec3<f32>,
   @location(1) vColor: vec4<f32>,
}

@fragment
fn main(
    in: inPut
) -> @location(0) vec4<f32> {

    var distance = length((in.coords.xy));

    var weight = 1.0 - smoothstep(in.coords.z * 0.5, in.coords.z , distance);

    var color = mix( vec4(0.0), in.vColor, weight);

    return color;

    // return vec4(in.vColor.rgb, weight);
}