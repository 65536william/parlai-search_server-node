const http = require("http");
const https = require("https");
const { parse } = require("querystring");
const fetch = require("node-fetch");
const { convert } = require("html-to-text");

const hostname = "127.0.0.1";
const port = 3000;
const SUBSCRIPTION_KEY = "3b8a48d19dd34400a7a68afab2d6b914";
if (!SUBSCRIPTION_KEY) {
  throw new Error("AZURE_SUBSCRIPTION_KEY is not set.");
}

async function getHTMLAsText(url) {
  return await fetch(url)
    .then((res) => res.text())
    .then((html) =>
      convert(html, {
        baseElements: {
          selectors: ["h1", "h2", "h3", "h4", "h5", "h6", "p", "pre"],
        },
        wordwrap: null,
      }).replace(/\n|\r/g, " ")
    );
}

const server = http.createServer((req, res) => {
  if (req.method == "POST") {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk.toString();
    });
    req.on("end", () => {
      const { q, n } = parse(data);
      res.statusCode = 200;
      res.setHeader("Content-Type", "text/plain");
      res.end("Hello World");
    });
  } else {
    res.statusCode = 500;
    res.end("Must use POST method.");
  }
});

server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});

function bingWebSearch(query, count) {
  https.get(
    {
      hostname: "api.bing.microsoft.com",
      path:
        "/v7.0/search?q=" +
        encodeURIComponent(query) +
        "&count=" +
        encodeURIComponent(count) +
        "&responseFilter=webpages",
      headers: { "Ocp-Apim-Subscription-Key": SUBSCRIPTION_KEY },
    },
    (res) => {
      let body = "";
      res.on("data", (part) => (body += part));
      res.on("end", async () => {
        const webpages = JSON.parse(body).webPages.value;
        const fetchedPages = await Promise.all(
          webpages.map(async (page, index) => ({
            index: index,
            url: page.url,
            title: page.name,
            content: await getHTMLAsText(page.url),
          }))
        );
        console.log(fetchedPages);
      });
      res.on("error", (e) => {
        console.log("Error: " + e.message);
        throw e;
      });
    }
  );
}

bingWebSearch("garibaldi", 5);

//function for calling server
// there is query_term and n which need to go as 'data' to server i.e. this
