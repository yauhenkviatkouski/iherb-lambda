import express from "express";
import cors from "cors";
import { IherbService } from "./IHerbService";

const app = express();
const urlencodedParser = express.urlencoded({ extended: false });

app.use(cors());
app.use(express.json());
app.post("/", urlencodedParser, async function (request, response) {
  if (!request.body) return response.sendStatus(400);
  const iHerbService = new IherbService();
  response.send(await iHerbService.parseUri(request.body.link));
});

app.listen(3000, () => console.log("Server is listening on 3000..."));
