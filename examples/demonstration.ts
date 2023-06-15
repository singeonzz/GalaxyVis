import galaxyvis from "../src/galaxyVis";
import { FruchtermanGPULayout } from "../src/layouts/gpu/gpuForce";

let galaxyVis = new galaxyvis({
    container: 'container',
})


let nodes = new Array();
let edges = new Array();
const demonstration = () => {
    nodes = new Array();
    edges = new Array();
    let colors = [
        '#965E04',
        '#C89435',
        '#F7A456',
        '#AFCF8A',
        '#7B39DE',
        '#B095C0',
    ];
    const addSmallComponents = (n, m) => {
        for (let i = 0; i < n; i++) {
            const baseId = nodes.length;
            for (let j = 0; j < m + 1; j++) {
                nodes.push({
                    id: baseId + j + '',
                });
            }
            for (let k = 1; k < m + 1; k++) {
                edges.push({
                    source: baseId + '', target: baseId + k + '',
                });
            }
            if (i <= n - 2) {
                edges.push({
                    source: i * (m + 1) + '',
                    target: (i + 1) * (m + 1) + '',
                });
            }

        }
    }

    addSmallComponents(2, 4);

    let gpuLayout = new FruchtermanGPULayout()

    gpuLayout.init(nodes, edges);

    gpuLayout.run()
};

demonstration();

export default demonstration;