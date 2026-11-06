export type EventId = '333' | '222' | 'pyram';
export type Penalty = 'none' | '+2' | 'DNF';
export type Solve = {
  id: string;
  number: number;
  event: EventId;
  timeCs: number;
  penalty: Penalty;
  scramble: string;
  scrambleId: string;
  source: 'manual' | 'timer';
  note: string;
  createdAt: string;
  roundId?: string;
  roundSlot?: number;
};
export type Scramble = {
  id: string;
  event: EventId;
  alg: string;
  createdAt: string;
  roundId?: string;
  roundSlot?: number;
};
export type TrainingRound = {
  id: string;
  event: EventId;
  createdAt: string;
  cancelledAt: string | null;
  completed: number;
  average: number | 'DNF' | null;
  slots: { slot: number; scramble: Scramble; solve: Solve | null }[];
};
export type Source = 'manual' | 'timer';
export type Goal = {
  id: string;
  event: EventId;
  kind: 'single' | 'ao5';
  targetCs: number;
  source: Source | 'all';
  createdAt: string;
  achieved: boolean;
  publicationId: string | null;
  best: { value: number; achievedAt: string; solveIds: string[]; measurementSource: string } | null;
};
export type Achievement = {
  id: string;
  event: EventId;
  kind: 'single' | 'ao5';
  targetCs: number;
  source: Source | 'all';
  value: number;
  achievedAt: string;
  publishedAt: string;
  measurementSource: string;
};
export type WcaRound = {
  round: string;
  position: number | null;
  best: number | null;
  average: number | null;
};
export type Competition = {
  id: string;
  name: string;
  city: string;
  country: string;
  date: string;
  results?: { event: string; rounds: WcaRound[] }[] | null;
};
export type WcaProfile = {
  id: string;
  name: string;
  country: string;
  personalRecords?: { event: string; single: number | null; average: number | null }[] | null;
  competitions: Competition[];
  importedAt: string;
  upcoming?: UpcomingData | null;
};
export type PositionEstimate = {
  event: string;
  basis: 'average' | 'single' | null;
  ownBest: number | null;
  total: number;
  comparable: number;
  missing: number;
  positionMin: number | null;
  positionMax: number | null;
  tied: number;
  reason: string | null;
};
export type UpcomingCompetition = Competition & {
  endDate: string;
  forecast: {
    eventIds?: string[];
    estimates?: PositionEstimate[];
    notice?: string | null;
    calculatedAt?: string | null;
    error?: string | null;
  } | null;
};
export type UpcomingData = {
  fetchedAt: string | null;
  competitions: UpcomingCompetition[];
};
export type UpcomingStatus = UpcomingData & {
  id: string;
  error: string | null;
  refreshing: boolean;
  forecast: {
    enabled: boolean;
    refreshing: boolean;
    lastAttemptAt: string | null;
    calculatedAt: string | null;
    nextAllowedAt: string;
    error: string | null;
  };
};
export type Profile = {
  name: string;
  bio: string;
  wcaId: string;
  showWca: boolean;
  showCompetitions: boolean;
  showUpcoming: boolean;
  calculateForecasts: boolean;
  wca: WcaProfile | null;
};
export type WcaSyncStatus = {
  id: string;
  enabled: boolean;
  intervalMinutes: number;
  refreshing: boolean;
  lastSuccessAt: string | null;
  lastAttemptAt: string | null;
  nextRefreshAt: string | null;
  error: string | null;
};
export type Publication = {
  id: string;
  event: EventId;
  kind: 'single' | 'ao5';
  title: string;
  result: number | 'DNF';
  solves: (Pick<Solve, 'timeCs' | 'penalty' | 'scramble' | 'createdAt'> & { source?: Source })[];
  createdAt: string;
};
export type PublicData = {
  profile: Omit<Profile, 'showWca' | 'showCompetitions' | 'showUpcoming' | 'calculateForecasts'>;
  publications: Publication[];
  achievements?: Achievement[];
};
