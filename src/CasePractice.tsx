import {
  caseGroupNames,
  caseGroups,
  caseGroupsByEvent,
  getCaseOrientation,
} from '../shared/case-practice.js';
import type { useDemoTraining } from './useDemoTraining';
import './case-practice.css';

type Training = ReturnType<typeof useDemoTraining>;
type Group = keyof typeof caseGroups;
const setupNotes: Partial<Record<Group, string>> = {
  f2l: ' Practica el par de la ranura delantera derecha.',
  eg1: ' La barra de la capa inferior queda delante.',
  l4e: ' Las dos aristas laterales de la base forman la V.',
};

export function PracticeMode({
  byCase,
  disabled,
  onChange,
}: {
  byCase: boolean;
  disabled: boolean;
  onChange: Training['chooseMode'];
}) {
  return (
    <div className="case-practice-mode" role="group" aria-label="Modo de práctica">
      <button
        type="button"
        disabled={disabled}
        aria-pressed={!byCase}
        onClick={() => onChange(false)}
      >
        Mezcla completa
      </button>
      <button
        type="button"
        disabled={disabled}
        aria-pressed={byCase}
        onClick={() => onChange(true)}
      >
        Por casos
      </button>
    </div>
  );
}

export function CaseSetup({
  practice,
  disabled,
  onChooseCase,
  onShowAlgorithm,
}: {
  practice: NonNullable<Training['casePractice']>;
  disabled: boolean;
  onChooseCase: Training['chooseCase'];
  onShowAlgorithm: (visible: boolean) => void;
}) {
  const { entry, preparation, showingAlgorithm } = practice;
  const { event, group } = entry;
  return (
    <section className="panel case-setup">
      <div className="case-selectors">
        <label>
          Grupo
          <select
            value={group}
            disabled={disabled}
            onChange={(event) => onChooseCase(caseGroups[event.target.value as Group][0].id)}
          >
            {caseGroupsByEvent[event].map((id) => (
              <option key={id} value={id}>
                {caseGroupNames[id]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Caso
          <select
            value={entry.id}
            disabled={disabled}
            onChange={(event) => onChooseCase(event.target.value)}
          >
            {caseGroups[group].map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <h2>Prepara el caso</h2>
      <p className="case-orientation">
        {event === 'pyram' ? 'Resuelve el Pyraminx' : 'Resuelve el cubo'} y colócalo con{' '}
        {getCaseOrientation(event)}. Aplica estos movimientos.
        {setupNotes[group]}
      </p>
      <div className="case-sequence" role="group" aria-label="Preparación del caso">
        <code>{preparation}</code>
      </div>
      <button
        className="text-button"
        type="button"
        disabled={disabled}
        aria-expanded={showingAlgorithm}
        onClick={() => onShowAlgorithm(!showingAlgorithm)}
      >
        {showingAlgorithm ? 'Ocultar algoritmo' : 'Ver algoritmo'}
      </button>
      {showingAlgorithm && (
        <div className="case-sequence" role="group" aria-label="Algoritmo del caso">
          <code>{entry.algorithm}</code>
        </div>
      )}
    </section>
  );
}
