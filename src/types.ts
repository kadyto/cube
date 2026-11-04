export type EventId = '333' | '222' | 'pyram';
export type Penalty = 'none' | '+2' | 'DNF';
export type Solve = {
  id: string;
  event: EventId;
  timeCs: number;
  penalty: Penalty;
  scramble: string;
  scrambleId: string;
  source: 'manual' | 'timer';
  note: string;
  createdAt: string;
};
export type Scramble = { id: string; event: EventId; alg: string; createdAt: string };
export type Competition = { id: string; name: string; city: string; country: string; date: string };
export type WcaProfile = {
  id: string;
  name: string;
  country: string;
  personalRecords?: { event: string; single: number | null; average: number | null }[] | null;
  competitions: Competition[];
  importedAt: string;
};
export type Profile = {
  name: string;
  bio: string;
  wcaId: string;
  showWca: boolean;
  showCompetitions: boolean;
  wca: WcaProfile | null;
};
export type Publication = {
  id: string;
  event: EventId;
  kind: 'single' | 'ao5';
  title: string;
  result: number | 'DNF';
  solves: Pick<Solve, 'timeCs' | 'penalty' | 'scramble' | 'createdAt'>[];
  createdAt: string;
};
export type PublicData = {
  profile: Omit<Profile, 'showWca' | 'showCompetitions'>;
  publications: Publication[];
};
