process.binding("http_parser").HTTPParser =
  require("http-parser-js").HTTPParser;
const http = require("http");
const https = require("https");
const { parse } = require("querystring");
const fetch = require("node-fetch");
const { convert } = require("html-to-text");

if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

var port = process.env.PORT || 8080;

const SUBSCRIPTION_KEY = process.env.AZURE_SUBSCRIPTION_KEY;
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
    )
    .catch((error) => console.log(error));
}

const server = http.createServer((req, res) => {
  if (req.method == "POST") {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk.toString();
    });
    req.on("end", () => {
      const { q, n } = parse(data);
      bingWebSearch(q, n)
        .then((fetchedPages) =>
          res.end(
            JSON.stringify({
              response: fetchedPages,
            })
          )
        )
        .catch((error) => res.end(JSON.stringify(error)));
    });
  } else {
    res.end("Must use POST method.");
  }
});

server.listen(port, () => {
  console.log(`Server running at ${port}`);
});

function bingWebSearch(query, count) {
  console.log(
    "/v7.0/search?q=" +
      encodeURIComponent(query) +
      "&answerCount=" +
      encodeURIComponent(count) +
      "&responseFilter=webpages"
  );
  return new Promise((resolve, reject) => {
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
          resolve(fetchedPages);
        });
        res.on("error", (e) => {
          console.log("Error: " + e.message);
          reject(e.message);
        });
      }
    );
  });
}
