"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Crown, ArrowUpDown } from "lucide-react";
import { Player } from "../types";

interface SwapPlayerDialogProps {
  open: boolean;
  onClose: () => void;
  playerToAdd: Player | null;
  xiPlayers: Player[];
  onSwap: (playerToRemoveId: string, playerToAddId: string) => void;
  captainId: string | null;
  viceCaptainId: string | null;
}

export default function SwapPlayerDialog({
  open,
  onClose,
  playerToAdd,
  xiPlayers,
  onSwap,
  captainId,
  viceCaptainId
}: SwapPlayerDialogProps) {
  const [selectedPlayerToRemove, setSelectedPlayerToRemove] = useState<string | null>(null);

  const handleSwap = () => {
    if (selectedPlayerToRemove && playerToAdd) {
      onSwap(selectedPlayerToRemove, playerToAdd.id);
      setSelectedPlayerToRemove(null);
      onClose();
    }
  };

  const handleCancel = () => {
    setSelectedPlayerToRemove(null);
    onClose();
  };

  // Get role color for badges
  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "POR":
        return "bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-700";
      case "DIF":
        return "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700";
      case "CEN":
        return "bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700";
      case "ATT":
        return "bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700";
      default:
        return "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600";
    }
  };

  if (!playerToAdd) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowUpDown className="h-5 w-5 text-blue-600" />
            Swap Players
          </DialogTitle>
          <DialogDescription>
            Your XI is full (11/11 players). Select a player to move to the bench to make room for{" "}
            <span className="font-semibold text-slate-900 dark:text-slate-100">{playerToAdd.name}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Player to Add */}
          <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-4 border border-emerald-200 dark:border-emerald-700">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-emerald-900 dark:text-emerald-100">Adding to XI</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="font-medium text-emerald-800 dark:text-emerald-200">{playerToAdd.name}</span>
                  <Badge variant="outline" className={getRoleBadgeColor(playerToAdd.role)}>
                    {playerToAdd.role}
                  </Badge>
                  <span className="text-sm text-emerald-700 dark:text-emerald-300">{playerToAdd.team}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Current XI Players */}
          <div className="space-y-2">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100">Select player to move to bench:</h3>
            
            {/* Show players grouped by role for better UX */}
            <div className="text-xs text-slate-500 dark:text-slate-400 mb-2">
              Tip: Consider swapping with a player of the same role ({playerToAdd.role}) for balanced formation
            </div>
            
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {/* Same role players first */}
              {xiPlayers
                .filter(player => player.role === playerToAdd.role)
                .map((player) => {
                  const isCaptain = captainId === player.id;
                  const isViceCaptain = viceCaptainId === player.id;
                  const isSelected = selectedPlayerToRemove === player.id;

                  return (
                    <button
                      key={player.id}
                      onClick={() => setSelectedPlayerToRemove(player.id)}
                      className={`w-full p-3 rounded-lg border transition-all text-left ${
                        isSelected
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-400"
                          : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-900 dark:text-slate-100">{player.name}</span>
                          <Badge variant="outline" className={getRoleBadgeColor(player.role)}>
                            {player.role}
                          </Badge>
                          <span className="text-sm text-slate-600 dark:text-slate-400">{player.team}</span>
                          <span className="px-1.5 py-0.5 text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 rounded">
                            Same role
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          {isCaptain && (
                            <div className="flex items-center justify-center w-6 h-6 bg-yellow-100 dark:bg-yellow-900/30 rounded-full">
                              <Crown className="h-3 w-3 text-yellow-600 dark:text-yellow-400" />
                            </div>
                          )}
                          {isViceCaptain && (
                            <div className="flex items-center justify-center w-6 h-6 bg-slate-100 dark:bg-slate-700 rounded-full">
                              <span className="text-xs font-bold text-slate-600 dark:text-slate-400">VC</span>
                            </div>
                          )}
                          {isSelected && (
                            <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                              <div className="w-2 h-2 bg-white rounded-full"></div>
                            </div>
                          )}
                        </div>
                      </div>
                      {(isCaptain || isViceCaptain) && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          {isCaptain ? "Note: This will remove captain status" : "Note: This will remove vice-captain status"}
                        </p>
                      )}
                    </button>
                  );
                })}
              
              {/* Different role players */}
              {xiPlayers
                .filter(player => player.role !== playerToAdd.role)
                .map((player) => {
                  const isCaptain = captainId === player.id;
                  const isViceCaptain = viceCaptainId === player.id;
                  const isSelected = selectedPlayerToRemove === player.id;

                  return (
                    <button
                      key={player.id}
                      onClick={() => setSelectedPlayerToRemove(player.id)}
                      className={`w-full p-3 rounded-lg border transition-all text-left ${
                        isSelected
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-400"
                          : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-900 dark:text-slate-100">{player.name}</span>
                          <Badge variant="outline" className={getRoleBadgeColor(player.role)}>
                            {player.role}
                          </Badge>
                          <span className="text-sm text-slate-600 dark:text-slate-400">{player.team}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          {isCaptain && (
                            <div className="flex items-center justify-center w-6 h-6 bg-yellow-100 dark:bg-yellow-900/30 rounded-full">
                              <Crown className="h-3 w-3 text-yellow-600 dark:text-yellow-400" />
                            </div>
                          )}
                          {isViceCaptain && (
                            <div className="flex items-center justify-center w-6 h-6 bg-slate-100 dark:bg-slate-700 rounded-full">
                              <span className="text-xs font-bold text-slate-600 dark:text-slate-400">VC</span>
                            </div>
                          )}
                          {isSelected && (
                            <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                              <div className="w-2 h-2 bg-white rounded-full"></div>
                            </div>
                          )}
                        </div>
                      </div>
                      {(isCaptain || isViceCaptain) && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          {isCaptain ? "Note: This will remove captain status" : "Note: This will remove vice-captain status"}
                        </p>
                      )}
                    </button>
                  );
                })}
            </div>
          </div>
        </div>

        <div className="flex gap-2 pt-4">
          <Button variant="outline" onClick={handleCancel} className="flex-1">
            Cancel
          </Button>
          <Button 
            onClick={handleSwap} 
            disabled={!selectedPlayerToRemove}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
          >
            Swap Players
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
