import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BookvocabApp } from "./bookvocab/BookvocabApp";
import "./bookvocab.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BookvocabApp />
  </StrictMode>,
);
