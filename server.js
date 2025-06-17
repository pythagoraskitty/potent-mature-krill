import { fileURLToPath } from 'url';
import path from 'path';
import got from 'got';
import fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyView from '@fastify/view';
import handlebars from 'handlebars';
import fs from 'fs';
import fetch from 'node-fetch';

(async () => {
  const server = fastify({ logger: true });

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  await server.register(fastifyStatic, {
    root: path.join(__dirname, "public"),
    prefix: "/", 
  });

  await server.register(fastifyView, { 
    engine: { 
      handlebars: handlebars 
    } 
  });
  
  const viewParams = {
    theme: 'light',
    index: '0',
    scriptText: '',
    func: '',
    numWorklets: '0'
  };
  
  const scriptParams = {}
  
  let numLoaded = 0;

  
  function setViewParams(request, func, scriptText='') {
    viewParams.theme = request.query.theme || 'light';
    viewParams.index = request.query.index || '0';
    viewParams.numWorklets = request.query.num || '0';
    viewParams.func = func;
    viewParams.scriptText = scriptText;
    //console.log(viewParams);
  }
  
  function setScriptText(scriptText) {
    viewParams.scriptText = scriptText;
    //console.log(viewParams);
  }
  
  function preventCaching(reply) {
    // Headers to prevent caching
    reply.header('Cache-Control', 'no-cache, no-store, must-revalidate'); 
    reply.header('Pragma', 'no-cache'); 
    reply.header('Expires', '0'); 
  }
  
  function setIframeHeaders(reply) {
    reply.header('Content-Type', 'text/html');
    preventCaching(reply);
  }
  
  function setFencedFrameHeaders(reply) {
    reply.header('Content-Type', 'text/html');
    reply.header('Supports-Loading-Mode', 'fenced-frame');
    preventCaching(reply);
  }
  
  function setImgHeaders(reply) {
    reply.header('Content-Type', 'image/webp');
    preventCaching(reply);
  }
  
  async function tryForwardImage(reply, imageUrl) {
    try {
      const response = await got(imageUrl, {responseType: 'buffer' });
      reply.send(response.body);
    } catch (error) {
      console.error('Error fetching image:', error);
      reply.code(500).send('Error fetching image');
    }
  }
  
  function tryForwardScript(reply, scriptUrl) {
    try {
      const data = fs.readFileSync(scriptUrl, 'utf8');
      reply.header('Content-Type', 'text/javascript');
      reply.send(data);
    } catch (error) {
      console.error('Error reading file: ', error);
      return;
    }
  }
  
  function tryForwardScriptAsText(scriptUrl) {
    try {
      const data = fs.readFileSync(scriptUrl, 'utf8');
      console.log(JSON.stringify(data));
      setScriptText(data);
    } catch (error) {
      console.error('Error reading file: ', error);
    }
  }
  
  function tryForwardScriptAsTextResponse(reply, scriptUrl) {
    try {
      const data = fs.readFileSync(scriptUrl, 'utf8');
      reply.header('Content-Type', 'text/plain');
      preventCaching(reply);
      console.log(data);
      reply.send(data);
    } catch (error) {
      console.error('Error reading file: ', error);
      return;
    }
  }
  

  
  // Our main GET home page route, pulls from src/pages/index.hbs
  server.get("/", async (request, reply) => {
    reply.header('Content-Type', 'text/html'); 
    return await reply.view("/src/pages/index.hbs", viewParams);
  });
  
  // Route for our custom code-box tag definition script
  server.get("/code-box", async (request, reply) => {
    tryForwardScript(reply, "public/code-box.js");
  });
  
  // Route for our custom dark mode script
  server.get("/dark-mode", async (request, reply) => {
    tryForwardScript(reply, "public/dark-mode.js");
  });
  
  // Route for our utils script
  server.get("/utils", async (request, reply) => {
    tryForwardScript(reply, "public/utils.js");
  });
  
  // Default document for the page's iframe
  server.get("/default-frame", async (request, reply) => {
    reply.header('Content-Type', 'text/html');
    setViewParams(request, '');
    return await reply.view("/src/pages/default-frame.hbs", viewParams);
  });
  
  // Route for the intermediate iframe "quick.hbs"
  server.get("/quick", async (request, reply) => {
    reply.header('Content-Type', 'text/html'); 
    setViewParams(request, 'quick');
    tryForwardScriptAsText("public/quick-module.js");
    return await reply.view("/src/pages/quick.hbs", viewParams);
  });
  
  // Route for our JS module with quick function
  server.get("/quick-module.js", async (request, reply) => {  
    tryForwardScript(reply, "public/quick-module.js");  
  });

  // Route for the fenced frame created by script
  server.get('/quick-inner', async (request, reply) => {
    setFencedFrameHeaders(reply);
    setViewParams(request, 'quick');
    numLoaded++;
    console.log("Loaded so far: ", numLoaded);
    return await reply.view("/src/pages/quick-inner.hbs", viewParams);
  });
  
  


  // Run the server and report out to the logs
  server.listen(
    { port: process.env.PORT, host: "0.0.0.0" },
    function (err, address) {
      if (err) {
        console.error(err);
        process.exit(1);
      }
      console.log(`Your app is listening on ${address}`);
    }
  );
})();
