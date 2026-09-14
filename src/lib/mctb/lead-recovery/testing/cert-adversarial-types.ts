export type Case = {
  id: string;
  section: string;
  run: () => Promise<void>;
};
