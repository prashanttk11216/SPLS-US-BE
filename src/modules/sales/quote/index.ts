import { Router } from "express";
import { createQuote, updateQuote, getQuotes, deleteQuote } from "./controller";

const quoteRouter = Router();

quoteRouter.get("/:quoteId?", getQuotes);

quoteRouter.post("/", createQuote);

quoteRouter.put("/:quoteId", updateQuote);

quoteRouter.delete("/:quoteId", deleteQuote);




export default quoteRouter;