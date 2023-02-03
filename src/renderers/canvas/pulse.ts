import { clone } from "lodash";
import NodeList from "../../classes/nodeList";
import { basicData, globalProp } from "../../initial/globalProp";
import { cancelFrame, getContainerHeight, getContainerWidth, mixColor, requestFrame, transformCanvasCoord, translateColor } from "../../utils";

export default class pulseCanvas {

    private graph: any;
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    public pulseFrameId: number | null = null;

    constructor(graph: any) {
        this.graph = graph;
        const id = graph.id
        const canvas = this.canvas = document.getElementById("pulse_" + id) as HTMLCanvasElement
        this.ctx = canvas.getContext('2d') as CanvasRenderingContext2D
    }

    render() {
        const self = this;
        const graph = self.graph
        const graphId = graph.id;
        const camera = graph.camera;

        camera.updateTransform()

        const transform = basicData[graphId]?.transform || 223
        let width = getContainerWidth(self.canvas),
            height = getContainerHeight(self.canvas);

        let renderType = graph.getRenderType();

        let pulseNodes: Set<string> = new Set();

        graph.events.on("nodesUnselected", (nodes: NodeList) => {
            nodes.setAttributes({
                pulse: {
                    range: [0, 0, 0]
                }
            })
        })

        function tickFrame() {
            let { selectedNodes, nodeList } = basicData[graphId]
            if (selectedNodes.size) {
                self.ctx.clearRect(0, 0, width, height);

                let position = clone(camera.position);
                let ratio = camera.ratio;
                let scale = (globalProp.globalScale / ratio) * 2.0
                if (renderType === "webgl") {
                    position[0] *= -transform;
                    position[1] *= transform;
                }
                selectedNodes.forEach((key: string) => {
                    let node = nodeList.get(key);
                    let {
                        x, y, pulse, radius
                    } = node.getAttribute();
                    let { range, duration, interval, scale: numScale, startRatio } = pulse;
                    const timeStep = interval / duration;
                    let ratioPulse = [startRatio - 1, startRatio - 1, startRatio - 1];
                    range[0] = Math.ceil((range[0] + timeStep) * 1e3) / 1e3;
                    if (range[0] >= numScale) range[1] = Math.ceil((range[1] + timeStep) * 1e3) / 1e3;
                    if (range[0] >= numScale * 2) range[2] = Math.ceil((range[2] + timeStep) * 1e3) / 1e3;
                    range.sort((a: number, b: number) => { return b - a })
                    if (range[0] >= numScale * 3) range[0] = 0.0;
                    node.changeAttribute({
                        pulse: {
                            range
                        }
                    })
                    let coord = transformCanvasCoord(graphId, x, y, position, scale)
                    x = coord.x;
                    y = coord.y;
                    range[0] && (ratioPulse[0] = range[0] + ratioPulse[0]) && self.drawPulse(ratioPulse[0], x, y, radius, scale, pulse);
                    range[1] && (ratioPulse[1] = range[1] + ratioPulse[1]) && self.drawPulse(ratioPulse[1], x, y, radius, scale, pulse);
                    range[2] && (ratioPulse[2] = range[2] + ratioPulse[2]) && self.drawPulse(ratioPulse[2], x, y, radius, scale, pulse);
                    pulseNodes.add(key);
                })

            } else if (pulseNodes.size) {
                self.ctx.clearRect(0, 0, width, height);

                pulseNodes.forEach((key: string) => {
                    let node = nodeList.get(key);
                    if (node) {
                        let pulse = node.getAttribute('pulse');
                        let { range } = pulse;
                        range = [0, 0, 0]
                        node.changeAttribute({
                            pulse: {
                                range
                            }
                        })
                    }
                })
                pulseNodes = new Set()
            }
            self.pulseFrameId = requestFrame(tickFrame)
        }
        self.pulseFrameId = requestFrame(tickFrame)
    }

    drawPulse(range: number, x: number, y: number, scale: number, radius: number, pulse: { [key: string]: any }) {
        const ctx = this.ctx;
        const graphId = this.graph.id;
        let {
            startColor,
            width,
            scale: numScale
        } = pulse;
        radius *= scale;
        width *= scale / 20;
        if(width == 0) return;
        let rgba = translateColor(startColor)
        ctx.beginPath();
        ctx.arc(x, y, radius * ((range) + 1), 0, Math.PI * 2);
        ctx.lineWidth = width;
        ctx.strokeStyle = `rgba(${rgba.r * 255}, ${rgba.g * 255}, ${rgba.b * 255}, ${(numScale * 3 - range) / range})`;
        ctx.stroke();
        ctx.closePath();
    }

    clear() {
        const self = this;
        let width = getContainerWidth(self.canvas),
            height = getContainerHeight(self.canvas);
        self.ctx.clearRect(0, 0, width, height);
        this.stop()
        this.render()
    }

    stop() {
        if (this.pulseFrameId) {
            cancelFrame(this.pulseFrameId);
            this.pulseFrameId = null;
        }
    }

    destory() {
        this.stop();
        const pulsePass = document.getElementById("pulse_" + this.graph.id) as HTMLCanvasElement;
        pulsePass.remove();
    }

}