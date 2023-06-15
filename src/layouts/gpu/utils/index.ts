export const attributesToTextureData = (attributeNames:any, items: any[]) => {
    const dataArray: any[] = [];
    const attributeNum = attributeNames.length;
    const attributteStringMap: any = {};
    items.forEach((item: any) => {
      attributeNames.forEach((name: string, i:any) => {
          if (attributteStringMap[item[name]] === undefined) {
              attributteStringMap[item[name]] = Object.keys(attributteStringMap).length;
          }
          dataArray.push(attributteStringMap[item[name]]);
          // insure each node's attributes take inter number of grids
          if (i === attributeNum - 1) {
              while (dataArray.length % 4 !== 0) {
                  dataArray.push(0);
              }
          }
      });
    });
    return {
        array: new Float32Array(dataArray),
        count: Object.keys(attributteStringMap).length
    };
}

export const buildTextureData = (nodes: any[], edges: any[]): {
    array: Float32Array,
    maxEdgePerVetex: number
  } => {
    const dataArray: any[] = [];
    const nodeDict: any = [];
    const mapIdPos: {[key:string]: any} = {};
    let i = 0;
    for (i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      mapIdPos[n.id] = i;
      dataArray.push(n.x);
      dataArray.push(n.y);
      dataArray.push(0);
      dataArray.push(0);
      nodeDict.push([]);
    }
    for (i = 0; i < edges.length; i++) {
      const e = edges[i];
      const source = e['source'];
      const target = e['target'];

      if (!isNaN(mapIdPos[source]) && !isNaN(mapIdPos[target])) {
        nodeDict[mapIdPos[source]].push(mapIdPos[target]);
        nodeDict[mapIdPos[target]].push(mapIdPos[source]);
      }
    }
  
    let maxEdgePerVetex = 0;
    for (i = 0; i < nodes.length; i++) {
      const offset: number = dataArray.length;
      const dests = nodeDict[i];
      const len = dests.length;
      dataArray[i * 4 + 2] = offset;
      dataArray[i * 4 + 3] = len;
      maxEdgePerVetex = Math.max(maxEdgePerVetex, len);
      for (let j = 0; j < len; ++j) {
        const dest = dests[j];
        dataArray.push(+dest);
      }
    }
  
    while (dataArray.length % 4 !== 0) {
        dataArray.push(0);
    }
    return {
      maxEdgePerVetex,
      array: new Float32Array(dataArray),
    };
  };