import { hashNumber, isInSceen } from "..";
import { basicData, globalInfo } from "../../initial/globalProp";

var typeHash: {[key:string]: any} = {}, baseTypeHash: {[key:string]: any}  = {}

export const gpuGetEdgeType = (that: any) => {

    let GraphId = that.id;
    let { edgeList, nodeList, relationTable } = basicData[GraphId]
    typeHash[GraphId] = new Map()
    baseTypeHash[GraphId] = new Map()

    const camera = that.camera

    for (let [key, item] of edgeList) {
        let attribute = item?.value?.attribute

        if (attribute) {
            let { type, source, target, isVisible, usedMerge, isFilter, isGroupEdge } = attribute
            if ((usedMerge && globalInfo[GraphId].mergeEdgesTransformat) ||
                (isFilter && globalInfo[GraphId].filterEdgesTransformat?.size)
            ) {
                isVisible = false
            }

            if (isGroupEdge) {
                let children = item.value.children;
                let cnt = 0
                for (let j = 0; j < children.length; j++) {
                    let edge = edgeList.get(children[j])
                    if (edge && edge.getAttribute('isVisible')) cnt++
                }
                if (cnt == children.length) 
                    isVisible = false
            }

            if (isVisible) {

                let sourceNode = nodeList.get(source);

                let targetNode = nodeList.get(target);

                let sourceAttribute = sourceNode.getAttribute();

                let targetAttribute = targetNode.getAttribute();

                if(
                    !isInSceen(GraphId, 'webgl', camera.ratio, camera.position, sourceAttribute, 1) &&
                    !isInSceen(GraphId, 'webgl', camera.ratio, camera.position, targetAttribute, 1)
                ){
                    continue;
                }
   
                let { num: source_n } = sourceNode.value
                let { num: target_n } = targetNode.value

                if (relationTable[source]) {
                    relationTable[source].add(key)
                } else if (!relationTable[source]) {
                    relationTable[source] = new Set([key])
                }
                if (relationTable[target]) {
                    relationTable[target].add(key)
                } else if (!relationTable[target]) {
                    relationTable[target] = new Set([key])
                }
                // 通过hashtable 计数
                let n = hashNumber(source_n, target_n)
                switch (type) {
                    case 'parallel':
                        if (source == target) {
                            throw Error('该类型不支持起点和终点是同一个')
                        }
                        if (typeHash[GraphId].has(n)) {
                            let total: any = typeHash[GraphId].get(n).total
                            typeHash[GraphId].set(n, {
                                num: typeHash[GraphId].get(n).num + 1,
                                total: total.add(key),
                            })
                        } else {
                            typeHash[GraphId].set(n, {
                                num: 1,
                                total: new Set().add(key),
                            })
                        }
                        break
                    case 'basic':
                        if (baseTypeHash[GraphId].has(n)) {
                            let total: any = baseTypeHash[GraphId].get(n).total
                            baseTypeHash[GraphId].set(n, {
                                num: baseTypeHash[GraphId].get(n).num + 1,
                                total: total.add(key),
                            })
                        } else {
                            baseTypeHash[GraphId].set(n, {
                                num: 1,
                                total: new Set().add(key),
                            })
                        }
                        break
                    default:
                        break
                }
            }
        }
    }

}

export const getTypeHash = (GraphId:string) => {
    return typeHash[GraphId]
}

export const getbashTypeHash = (GraphId:string) => {
    return baseTypeHash[GraphId]
}

export const clearTypeHash = (GraphId:string) => {
    typeHash[GraphId] = null;
    delete typeHash[GraphId]
}

export const clearbashTypeHash = (GraphId:string) => {
    baseTypeHash[GraphId] = null;
    delete baseTypeHash[GraphId]
}