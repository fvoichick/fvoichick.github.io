$(() => {
  $("#form").submit(onSubmit);

  const url = new URL(window.location.href)
  const search = url.searchParams;
  const start = search.get("start");
  if (start) {
    $("#start-page").val(start);
  }
  const target = search.get("target");
  if (target) {
    $("#target-page").val(target);
  }
});

let worker = null;

function onSubmit(event) {
  if (worker !== null) {
    worker.terminate();
  }
  worker = new Worker("/game/worker.js");
  event.preventDefault();
  const resultDiv = document.getElementById("result");
  resultDiv.textContent = "";
  $("#error").attr("hidden", true);
  const currentDiv = $("#current-div");
  currentDiv.attr("hidden", true);
  $("#click-count").attr("hidden", true);
  const progressArea = $("#progress-bars");
  progressArea.attr("hidden", true).empty();
  const origin = $("#start-page").val();
  const target = $("#target-page").val();
  const promises = [resolveRedirects(origin), resolveRedirects(target)];
  Promise.all(promises).then(resolved => {
    const updatedOrigin = resolved[0];
    const updatedTarget = resolved[1];
    $("#start-page").val(updatedOrigin);
    $("#target-page").val(updatedTarget);
    $("#result-start").text(updatedOrigin);
    $("#at-least").removeAttr("hidden");
    $("#num-clicks").text("1");
    $("#num-clicks-prev").text("0");
    $("#click-plural").attr("hidden", true);
    $("#click-prev-plural").removeAttr("hidden");
    $("#result-end").text(updatedTarget);
    $("#hint-target").text(updatedTarget);
    $("#click-count").removeAttr("hidden");
    const progBars = [];
    worker.onmessage = e => {
      const data = e.data;
      switch (data.type) {
        case "path":
          resultDiv.textContent = "";
          resultDiv.appendChild(htmlFromPath(data.path, updatedOrigin));
          $("#at-least").attr("hidden", true);
          return;
        case "complete":
          resultDiv.textContent = "";
          resultDiv.appendChild(htmlFromPath(data.path, updatedOrigin));
          currentDiv.attr("hidden", true);
          progressArea.attr("hidden", true);
          return;
        case "page":
          const page = data.page;
          const currentText = page === null ? "" : data.page;
          $("#current").val(currentText);
          const numClicks = data.numClicks;
          $("#num-clicks").text(numClicks);
          $("#num-clicks-prev").text(numClicks - 1);
          if (numClicks === 2) {
            $("#click-prev-plural").attr("hidden", true);
          } else {
            $("#click-prev-plural").removeAttr("hidden");
          }
          if (numClicks !== 1) {
            $("#click-plural").removeAttr("hidden");
            if (numClicks >= 2) {
              const barIndex = numClicks - 2;
              if (barIndex >= progBars.length) {
                const progDiv = document.createElement("div");
                progDiv.classList.add("progress", "mb-2");
                const progBar = document.createElement("div");
                progBar.classList.add("progress-bar", "progress-bar-striped", "progress-bar-animated");
                $(progBar).attr("role", "progressbar").attr("aria-valuemin", 0).attr("aria-valuemax");
                progDiv.appendChild(progBar);
                document.getElementById("progress-bars").appendChild(progDiv);
                progBars.push(progBar)
              }
              for (let i = 0; i < progBars.length - 1; i++) {
                const oldBar = progBars[i];
                oldBar.classList.remove("progress-bar-animated");
                $(oldBar).attr("style", "width: 100%").attr("aria-valuenow", 100);
              }
              const progress = data.progress;
              const bar = progBars[barIndex];
              $(bar).attr("style", "width: " + progress + "%").attr("aria-valuenow", progress);
              progressArea.removeAttr("hidden");
            }
          }
          currentDiv.removeAttr("hidden");
          return;
        case "numClicks":
          return;
      }
    };
    worker.postMessage({start: updatedOrigin, goal: updatedTarget});
  }).catch(reason => {
    $("#error").text(reason).removeAttr("hidden");
  });
  return false;
}

function htmlFromPath(path, start) {
  const ul = document.createElement("ul");
  const li = document.createElement("li");
  const code = document.createElement("code");
  code.textContent = start;
  li.appendChild(code);
  ul.appendChild(li);
  if (path.has(start)) {
    // const details = document.createElement("details");
    // const summary = document.createElement("summary");
    // summary.textContent = start;
    // details.appendChild(summary);
    for (const child of path.get(start).sort()) {
      // details.appendChild(htmlFromPath(path, child));
      ul.appendChild(htmlFromPath(path, child));
    }
    // return details;
  } else {
    // return document.createTextNode(start);
  }
  return ul;
}

function resolveRedirects(pageName) {
  return new Promise((resolve, reject) => {
    $.getJSON("https://en.wikipedia.org/w/api.php", {
      action: "query",
      titles: pageName,
      redirects: true,
      format: "json",
      formatversion: 2,
      origin: "*"
    }, data => {
      const page = data.query.pages[0];
      if (page.missing) {
        reject("Unable to find page: " + pageName);
      } else {
        resolve(page.title);
      }
    }).fail((jqXhr, textStatus, error) => reject(error));
  });
}

// function bfs(start, goal) {
//   function bfs(starts, closed, cameFrom) {
//     const nextStarts = new Set();
//     const promises = starts.map(origin => getLinks(origin).then(links => {
//       console.log("examining page: " + origin);
//       for (const link of links) {
//         if (closed.has(link)) {
//           continue;
//         }
//         if (!nextStarts.has(link)) {
//           nextStarts.add(link);
//           cameFrom.set(link, []);
//         }
//         cameFrom.get(link).push(origin);
//       }
//     }).catch(reason => {
//       console.error("Unable to get links for " + origin + ": " + reason);
//     }));
//     return new Promise(resolve => {
//       Promise.all(promises).then(() => {
//         const newClosed = new Set(cameFrom.keys());
//         if (newClosed.has(goal)) {
//           resolve(path(cameFrom, goal));
//         } else if (nextStarts.size === 0) {
//           reject("no path");
//         } else {
//           bfs(Array.from(nextStarts), newClosed, cameFrom).then(resolve);
//         }
//       })
//     });
//   }
//
//   return bfs([start], new Set([start]), new Map([[start, []]]));
// }
//
// function path(cameFrom, goal) {
//   const result = new Map();
//   const goals = [goal];
//   while (goals.length > 0) {
//     const dst = goals.pop();
//     const srcs = cameFrom.get(dst);
//     for (const src of srcs) {
//       if (!result.has(src)) {
//         result.set(src, []);
//         goals.push(src);
//       }
//       result.get(src).push(dst);
//     }
//   }
//   return result;
// }
//
// /**
//  * Gets the links on a given page.
//  * @param {string} page - The title of the desired page.
//  * @returns {Promise<Array<string>>}
//  */
// function getLinks(page) {
//   return new Promise((resolve, reject) => {
//     const modTime = Date.now() % 10000;
//     if (modTime >= 1000) {
//       setTimeout(() => getLinks(page).then(resolve), 10000 - modTime);
//       return;
//     }
//     $.ajax({
//       url: "https://en.wikipedia.org/w/api.php",
//       data: {
//         action: "parse",
//         // titles: page,
//         page: page,
//         redirects: true,
//         prop: "links",
//         // plnamespace: 0,
//         origin: "*",
//         format: "json"
//         // pllimit: "max"
//       }
//     }).done((data, status, jqXhr) => {
//       if (status !== "success")
//         reject(status);
//       switch (jqXhr.status) {
//         case 200:
//           if (data.error) {
//             reject(data.error.info);
//             return;
//           }
//           resolve(
//               data.parse.links.filter(
//                   value => value.ns === 0 && value.exists !== undefined
//               ).map(
//                   value => value["*"]
//               )
//           );
//           return;
//         case 429:
//           console.warn("retrying " + page);
//           setTimeout(() => {
//             getLinks(page).then(resolve)
//           }, 2000 * jqXhr.getResponseHeader("retry-after"));
//           return;
//         default:
//           reject(jqXhr.status);
//       }
//     });
//   });
// }

// function getLinks(page) {
//   return new Promise((resolve, reject) => {
//     const xhttp = new XMLHttpRequest();
//     const url = "https://en.wikipedia.org/w/api.php?action=parse&redirects=true&prop=links&origin=*&format=json&page=" + encodeURIComponent(page);
//     xhttp.open("GET", url);
//     xhttp.onreadystatechange = () => {
//       if (xhttp.readyState !== 4) {
//         return;
//       }
//       switch (xhttp.status) {
//         case 200:
//           const data = JSON.parse(xhttp.responseText);
//           if (data.error) {
//             reject(data.error.info);
//             return;
//           }
//           resolve(
//               data.parse.links.filter(
//                   value => value.ns === 0 && value.exists !== undefined
//               ).map(
//                   value => value["*"]
//               )
//           );
//           return;
//         case 429:
//           console.warn("retrying " + page);
//           setTimeout(() => {
//             getLinks(page).then(resolve)
//           }, 1000 * xhttp.getResponseHeader("retry-after"));
//           return;
//         default:
//           reject(xhttp.status);
//           return;
//       }
//     };
//     xhttp.send();
//   });
// }
