import { isNumber } from "lodash"
import { attributesToTextureData, buildTextureData } from "./utils"

// import  World  from "./utils/index.umd"
// @ts-ignore
// import World from "@antv/g-webgpu";

export class FruchtermanGPULayout {
    public maxIteration: number = 300 // 最大迭代次数

    public gravity: number = 10 // 重力大小

    public speed: number = 1 // 迭代速度

    public nodeMap: {[key:string]: any} = {}

    public nodeIdxMap: {[key:string]: any} = {}

    public nodes: any

    public edges: any
    
    constructor() {}

    init = (
        nodes:any, edges:any
    ) => {
        this.nodes = nodes;
        this.edges = edges;

        this.excute()
    }

    excute = () => {
        const width = window.innerWidth;

        const height = window.innerHeight;

        const center = [width / 2, height / 2];

        const nodes = this.nodes;

        if(nodes.length == 1){
            nodes[0].x = center[0];
            nodes[0].y = center[1];
            return ;
        }

        const nodeMap:any = {}, nodeIdxMap:any = {}

        nodes.forEach((node:any,i:number)=>{
            node.x = Math.random() * width;
            node.y = Math.random() * height;

            nodeMap[node.id] = node;
            nodeIdxMap[node.id] = i;
        })

        this.nodeMap = nodeMap

        this.nodeIdxMap = nodeIdxMap
    }

    run = () => {
        const maxIteration = this.maxIteration;

        const gravity = this.gravity;

        const speed = this.speed;

        const nodeMap = this.nodeMap; 
        
        const nodeIdxMap = this.nodeIdxMap;

        const nodes = this.nodes;

        const edges = this.edges;

        const {
            array: attributeArray,
            count: clusterCount
        } = attributesToTextureData(["cluster"], nodes);
      
        nodes.forEach((node:any, i:number) => {
            let fx = 0;
            let fy = 0;
            if (isNumber(node.fx) && isNumber(node.fy)) {
              fx = node.fx || 0.001;
              fy = node.fy || 0.001;
            }
            attributeArray[4 * i + 1] = fx;
            attributeArray[4 * i + 2] = fy;
        });

        const numParticles = nodes.length;
        
        const { 
            maxEdgePerVetex, 
            array: nodesEdgesArray 
        } = buildTextureData(nodes,edges);

        console.log(maxEdgePerVetex)

        console.log(nodesEdgesArray)

        // console.log(World)
        let world

        // world = World.create({
        //     engineOptions: {
        //       supportCompute: true
        //     }
        // });

        console.log(world)
    }
}
