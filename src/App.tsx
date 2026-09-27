import React, { useState } from 'react';
import { ActiveScreen, AgentStatus, AutonomyMode } from './types';
import { INITIAL_AGENTS } from './data/mockFlightData';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { OrbitalTwinScreen } from './components/OrbitalTwinScreen';
import { AgentMeshScreen } from './components/AgentMeshScreen';
import { ChaosAnomalyLabScreen } from './components/ChaosAnomalyLabScreen';
import { AnalyticsScreen } from './components/AnalyticsScreen';
import { PropellantlessControlScreen } from './components/PropellantlessControlScreen';
import { OrbitalCaseSimulatorScreen } from './components/OrbitalCaseSimulatorScreen';
import { StartupRoutineModal } from './components/StartupRoutineModal';
import { sound } from './utils/audio';

export default function App() {
  const [activeScreen, setActiveScreen] = useState<ActiveScreen>('orbital-twin');
  const [agents, setAgents] = useState<AgentStatus[]>(INITIAL_AGENTS);
  const [autonomyMode, setAutonomyMode] = useState<AutonomyMode>('L4');
  const [agentAlertCount, setAgentAlertCount] = useState<{ crit: number; warn: number }>({
    crit: 0,
    warn: 0,
  });
  const [selectedPresetId, setSelectedPresetId] = useState<string>('thermal');
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [showStartupRoutine, setShowStartupRoutine] = useState<boolean>(true);

  const handleSelectScreen = (screen: ActiveScreen) => {
    sound.playClick();
    setActiveScreen(screen);
    setSidebarOpen(false);
  };

  const handleToggleAgentIsolation = (agentId: string) => {
    setAgents((prev) =>
      prev.map((agent) =>
        agent.id === agentId
          ? {
              ...agent,
              isolated: !agent.isolated,
              state: !agent.isolated ? 'isolated' : 'nominal',
            }
          : agent
      )
    );
  };

  const handleSelectPreset = (presetId: string) => {
    setSelectedPresetId(presetId);
    setActiveScreen('anomaly-lab');
    sound.playClick();
  };

  const handleOpenOverrideDeck = () => {
    sound.playClick();
    setActiveScreen('agent-mesh');
    setSidebarOpen(false);
  };

  const isolatedCount = agents.filter((a) => a.isolated).length;

  return (
    <div className="min-h-screen bg-[#0c0e12] text-[#f0f2f5] font-sans selection:bg-amber-500 selection:text-black flex flex-col antialiased">
      {/* Top Aerospace Mission Header */}
      <Header
        activeScreen={activeScreen}
        onSelectScreen={handleSelectScreen}
        autonomyMode={autonomyMode}
        agentAlertCount={agentAlertCount}
        isolatedAgentCount={isolatedCount}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        sidebarOpen={sidebarOpen}
        onOpenStartupRoutine={() => setShowStartupRoutine(true)}
      />

      <div className="flex-1 flex pt-16">
        {/* Navigation Sidebar */}
        <Sidebar
          activeScreen={activeScreen}
          onSelectScreen={handleSelectScreen}
          onOpenOverrideDeck={handleOpenOverrideDeck}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onOpenStartupRoutine={() => setShowStartupRoutine(true)}
        />

        {/* Main Operational Viewport */}
        <main className="flex-1 min-w-0 p-4 lg:p-6 overflow-y-auto">
          <div className="max-w-7xl mx-auto flex flex-col gap-6">
            {activeScreen === 'orbital-twin' && (
              <OrbitalTwinScreen
                agents={agents}
                onSelectScreen={handleSelectScreen}
                onSelectPreset={handleSelectPreset}
                activeAnomalySeverity={agentAlertCount.crit > 0 ? 3 : agentAlertCount.warn > 0 ? 1 : 0}
                activeAnomalyPresetId={selectedPresetId}
              />
            )}

            {activeScreen === 'agent-mesh' && (
              <AgentMeshScreen
                agents={agents}
                onToggleAgentIsolation={handleToggleAgentIsolation}
                autonomyMode={autonomyMode}
                onChangeAutonomyMode={(mode) => setAutonomyMode(mode)}
              />
            )}

            {activeScreen === 'anomaly-lab' && (
              <ChaosAnomalyLabScreen
                selectedPresetId={selectedPresetId}
                onPresetChange={(id) => setSelectedPresetId(id)}
                onUpdateAlertCount={(crit, warn) => setAgentAlertCount({ crit, warn })}
                agents={agents}
                onToggleAgentIsolation={handleToggleAgentIsolation}
              />
            )}

            {activeScreen === 'propellantless' && <PropellantlessControlScreen />}

            {activeScreen === 'orbital-cases' && <OrbitalCaseSimulatorScreen />}

            {activeScreen === 'analytics' && <AnalyticsScreen agents={agents} />}
          </div>
        </main>
      </div>

      {/* Autonomous Pre-flight Startup Routine & Orion Launch Modal */}
      <StartupRoutineModal
        isOpen={showStartupRoutine}
        onClose={() => setShowStartupRoutine(false)}
      />
    </div>
  );
}
