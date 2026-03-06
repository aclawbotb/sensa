import { Candidate } from "./types";

type Session = {
  id: string;
  fieldId: string;
  query: string;
  candidates: Candidate[];
};

const sessions = new Map<string, Session>();

export function saveSession(s: Session) {
  sessions.set(s.id, s);
}

export function getSession(id: string): Session | undefined {
  return sessions.get(id);
}
