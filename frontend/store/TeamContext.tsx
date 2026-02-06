"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { Team, fetchTeams } from "@/services/teams";

interface TeamContextType {
  teams: Team[];
  selectedTeam: Team | null;
  setSelectedTeam: (team: Team) => void;
  isLoading: boolean;
  error: string | null;
  isOwner: boolean;
}

const TeamContext = createContext<TeamContextType | undefined>(undefined);

export function TeamProvider({ children }: { children: React.ReactNode }) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeamState] = useState<Team | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadTeams() {
      try {
        setIsLoading(true);
        const userTeams = await fetchTeams();
        setTeams(userTeams);

        // Try to restore selected team from localStorage
        const savedTeamId = localStorage.getItem("selectedTeamId");
        const savedTeam = userTeams.find((t) => t.id.toString() === savedTeamId);

        // Set selected team (saved team or first team)
        if (savedTeam) {
          setSelectedTeamState(savedTeam);
        } else if (userTeams.length > 0) {
          setSelectedTeamState(userTeams[0]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load teams");
      } finally {
        setIsLoading(false);
      }
    }

    loadTeams();
  }, []);

  const setSelectedTeam = (team: Team) => {
    setSelectedTeamState(team);
    localStorage.setItem("selectedTeamId", team.id.toString());
  };

  // Check if current user is owner of selected team
  const isOwner = selectedTeam?.is_owner ?? false;

  return (
    <TeamContext.Provider
      value={{
        teams,
        selectedTeam,
        setSelectedTeam,
        isLoading,
        error,
        isOwner,
      }}
    >
      {children}
    </TeamContext.Provider>
  );
}

export function useTeamContext() {
  const context = useContext(TeamContext);
  if (context === undefined) {
    throw new Error("useTeamContext must be used within a TeamProvider");
  }
  return context;
}
