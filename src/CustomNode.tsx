import { Handle, Position } from '@xyflow/react';
import './MapStyles.css';
import lockIcon  from './assets/lock.png';
import checkIcon from './assets/check.png';

interface MicroSkill {
  id: number;
  phase_status: 'mastered' | 'phase_B_done' | 'phase_A_done' | 'not_started';
}

interface CustomNodeData {
  title: string;
  grade: string;
  status: 'locked' | 'active' | 'mastered';
  micro_skills: MicroSkill[];
}

interface CustomNodeProps {
  data: CustomNodeData;
}

export default function CustomNode({ data }: CustomNodeProps) {
  return (
    <div className="relative flex flex-col items-center">

      {/* AAPA-маркер над карточкой */}
      {data.status !== 'locked' && (
        <span className="absolute -top-5 tracking-wider uppercase text-white"
              style={{ fontSize: 10 }}>
          AAPA
        </span>
      )}

      {/* Главная карточка */}
      <div className={`rpg-node-card status-${data.status}`}>

        <Handle type="target" position={Position.Top}    style={{ opacity: 0 }} />

        {/* Бейдж класса */}
        <span className="font-mono text-slate-400 text-xs mb-1 tracking-widest uppercase">
          {data.grade}
        </span>

        {/* Название модуля */}
        <span className="text-white font-semibold text-sm text-center leading-snug">
          {data.title}
        </span>

        {/* Иконка замка (locked) */}
        {data.status === 'locked' && (
          <img
            src={lockIcon}
            alt="locked"
            className="absolute inset-0 m-auto"
            style={{ imageRendering: 'pixelated', width: 24, height: 24 }}
          />
        )}

        {/* Иконка победы (mastered) */}
        {data.status === 'mastered' && (
          <img
            src={checkIcon}
            alt="mastered"
            className="absolute top-2 right-2"
            style={{ imageRendering: 'pixelated', width: 16, height: 16 }}
          />
        )}

        <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
      </div>

      {/* Орбитальные руны — строго под карточкой, вне border-image */}
      {data.micro_skills && data.micro_skills.length > 0 && (
        <div className="absolute -bottom-5 flex flex-row gap-2 items-center justify-center">
          {data.micro_skills.map((skill) => (
            <div
              key={skill.id}
              className={`orbital-rune rune-${skill.phase_status}`}
            />
          ))}
        </div>
      )}

    </div>
  );
}
