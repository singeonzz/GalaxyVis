import galaxyvis from '../src/galaxyVis'

let renderer = 'webgpu'
// let renderer = 'webgl'

let galaxyVis = new galaxyvis({
    container: 'container',
    renderer: renderer,
    options: {
        backgroundColor: '#F9FBFF',
    },
})

let k3 = ['', '1', '\ue63a', '\ue63a']

let imgs = ['/public/img/sky.jpg']

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
    const drawNum = 5
    let arr = new Array()
    let num = Math.floor(Math.sqrt(drawNum) + 0.5)
    let line = new Array()
    for (let i = 0; i < drawNum; i++) {
        arr[i] = {
            id: `n${i}`,
            attribute: {
                x: (i % num) * 400,
                y: Math.floor(i / num) * 100,
                color: colors[Math.floor(Math.random() * colors.length) || 0],
                text: `n${i}`,
                innerStroke: {
                    width: 2.0,
                    color: colors[Math.floor(Math.random() * colors.length) || 0],
                },
                // halo: {
                //     width: 10,
                //     color: "#f00"
                // }
                // icon: {
                //     content: k3[i % 3],
                //     font: 'iconfont',
                // },
                // badges:
                //     i == 1
                //         ? {
                //               topRight: {
                //                   color: '#f00',
                //                   text: {
                //                       font: 'iconfont',
                //                       color: '#fff',
                //                       content: '\ue63a',
                //                       scale: 0.6,
                //                   },
                //                   stroke: {
                //                       color: '#fff',
                //                       width: 1,
                //                   },
                //               },
                //           }
                //         : null,
            },
        }

        i != drawNum - 1 &&
            (line[i] = {
                source: `n${i}`,
                target: `n${i + 1}`,
                attribute: {
                    color: colors[Math.floor(Math.random() * colors.length) || 0],
                    text: `e${i}`,
                    shape: {
                        head: i % 2 == 0 ? 'arrow' : null,
                    },
                    // halo: {
                    //     width: 5,
                    //     color: "#00f"
                    // }
                },
            })
    }

    // line.push({
    //     source: 'n0',
    //     target: 'n1',
    //     attribute: {
    //         shape: {
    //             head: 'arrow',
    //         },
    //         width: 1.2,
    //     },
    // })

    galaxyVis.gpu.then(() => {
        galaxyVis
            .addGraph({
                nodes: arr,
                edges: line,
            })
            .then(() => {
                // galaxyVis.layouts.force({duration: 1500})
            })
    })
}

// @ts-ignore
window.galaxyVis = galaxyVis

testEvent()

export default testEvent
