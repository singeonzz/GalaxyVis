struct inPut {
   @location(0) vColor: vec4<f32>,
   @location(1) coords: vec2<f32>
}

fn sdEquilateralTriangle(p: vec2<f32>) -> f32 {
    const k = sqrt(3.);
    var triangle = p;

    triangle.x = abs(triangle.x)-1.;
    triangle.y = triangle.y + 2. / k;
    if triangle.x + k * triangle.y > 0. {
        triangle = vec2(triangle.x - k * triangle.y, -k * triangle.x - triangle.y) / 2.;
    }
    triangle.x -= clamp(triangle.x, -3., 0.);

    return-length(triangle) * sign(triangle.y);
}

@fragment
fn main(
    in: inPut
) -> @location(0) vec4<f32> {
    var d = sdEquilateralTriangle(in.coords - vec2(.5, .1)) * 2.0;

    var col: vec4<f32>;

    if sign(d) <= 0.0 {
        col = in.vColor;
    } else {
        col = vec4(0.0);
    }
        // 边缘处理
    col = mix(col, in.vColor, 1. - smoothstep(.001, .1, abs(d)));

    if (col.r + col.g + col.b) != 3. {
        return col;
    } else {
        return vec4(0.);
    }
}