import galaxyvis from '../src/galaxyVis'

let renderer = 'webgpu'
let galaxyVis = new galaxyvis({
    container: 'container',
    renderer: renderer,
    options: {
        backgroundColor: '#F9FBFF',
    },
})

const testEvent = () => {
    let colors = [
        '#965E04',
        '#C89435',
        '#F7A456',
        '#AFCF8A',
        '#7B39DE',
        '#B095C0',
        '#D24556',
        '#93C2FA',
        '#9DB09E',
        '#F8C821',
    ]
    const drawNum = 10
    let arr = new Array()
    let num = Math.floor(Math.sqrt(drawNum) + 0.5)
    for (let i = 0; i < drawNum; i++) {
        arr[i] = {
            id: `n${i}`,
            attribute: {
                x: (i % num) * 100 - 100,
                y: Math.floor(i / num) * 100 - 150,
                color: colors[Math.floor(Math.random() * colors.length) || 0],
                text: `n${i}`,
                // innerStroke: {
                //     width: 2.0,
                //     color: "#f0f"
                // }
            },
        }
    }
    galaxyVis.addGraph({
        nodes: arr,
        // edges: line
    })
}

testEvent()

export default testEvent
