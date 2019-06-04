function bfs(start, goal) {
  function bfs(starts, closed, cameFrom, numClicks) {
    shuffle(starts);
    const nextStarts = new Set();
    for (const origin of starts) {
      postMessage({type: "page", page: origin});
      const links = getLinks(origin);
      for (const link of links) {
        if (closed.has(link)) {
          continue;
        }
        if (!nextStarts.has(link)) {
          nextStarts.add(link);
          cameFrom.set(link, []);
        }
        cameFrom.get(link).push(origin);
        if (link === goal) {
          pathFound(cameFrom, goal);
        }
      }
    }
    const newClosed = new Set(cameFrom.keys());
    if (newClosed.has(goal)) {
      return path(cameFrom, goal);
    } else if (nextStarts.size === 0) {
      throw "no path";
    } else {
      postMessage({type: "numClicks", numClicks: numClicks + 2});
      return bfs(Array.from(nextStarts), newClosed, cameFrom, numClicks + 1);
    }
  }

  return bfs([start], new Set([start]), new Map([[start, []]]), 0);
}

function path(cameFrom, goal) {
  const result = new Map();
  const goals = [goal];
  while (goals.length > 0) {
    const dst = goals.pop();
    const srcs = cameFrom.get(dst);
    for (const src of srcs) {
      if (!result.has(src)) {
        result.set(src, []);
        goals.push(src);
      }
      result.get(src).push(dst);
    }
  }
  return result;
}

function getLinks(page) {
  const xhttp = new XMLHttpRequest();
  const url = "https://en.wikipedia.org/w/api.php?action=parse&redirects=true"
      + "&prop=links&origin=*&format=json&page=" + encodeURIComponent(page);
  xhttp.open("GET", url, false);
  xhttp.send();
  if (xhttp.readyState !== 4) {
    throw "readyState is " + xhttp.readyState;
  }
  if (xhttp.status === 200) {
    const data = JSON.parse(xhttp.responseText);
    if (data.error) {
      throw data.error.info;
    }
    return data.parse.links.filter(
        value => value.ns === 0 && value.exists !== undefined
    ).map(
        value => value["*"]
    );
  } else {
    throw "HTTP status is " + xhttp.status;
  }
}

// https://stackoverflow.com/a/12646864
function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

onmessage = function (e) {
  const result = bfs(e.data.start, e.data.goal);
  postMessage({type: "complete", path: result});
};

function pathFound(cameFrom, goal) {
  const foundPath = path(cameFrom, goal);
  postMessage({type: "path", path: foundPath});
}