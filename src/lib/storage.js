import { createSeedData } from "./sample-data.js";

export const STORAGE_KEY = "helixdesk:v1";

export const createId = (prefix) => {
  const value = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `${prefix}-${Date.now().toString(36).toUpperCase()}${value}`;
};

export const loadData = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      const seeded = createSeedData();
      saveData(seeded);
      return seeded;
    }
    return JSON.parse(stored);
  } catch (error) {
    console.warn("Unable to load HelixDesk data; resetting seed data.", error);
    const seeded = createSeedData();
    saveData(seeded);
    return seeded;
  }
};

export const saveData = (data) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

export const resetData = () => {
  const seeded = createSeedData();
  saveData(seeded);
  return seeded;
};

export const downloadJson = (data, filename) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};
