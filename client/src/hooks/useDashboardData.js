import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../api/client.js';

export default function useDashboardData(projectId) {
  const [core, setCore] = useState({
    projects: [],
    users: [],
    brands: [],
    googleStatus: { configured: false, linked: false },
    status: 'loading',
    error: '',
  });
  const [taskState, setTaskState] = useState({ tasks: [], status: 'idle', error: '' });
  const coreRequest = useRef(0);
  const taskRequest = useRef(0);

  const loadCore = useCallback(async () => {
    const requestId = ++coreRequest.current;
    setCore((current) => ({ ...current, status: 'loading', error: '' }));
    try {
      const [projectData, userData, brandData, googleStatus] = await Promise.all([
        api.projects(),
        api.users(),
        api.brands(),
        api.googleIntegrationStatus().catch(() => ({ configured: false, linked: false })),
      ]);
      if (requestId !== coreRequest.current) return;
      setCore({
        projects: projectData.projects,
        users: userData.users,
        brands: brandData.brands,
        googleStatus,
        status: 'ready',
        error: '',
      });
    } catch (error) {
      if (requestId !== coreRequest.current) return;
      setCore((current) => ({
        ...current,
        status: 'error',
        error: error.message || 'Unable to load workspace data',
      }));
    }
  }, []);

  const loadTasks = useCallback(async (nextProjectId = projectId) => {
    const requestId = ++taskRequest.current;
    if (!nextProjectId) {
      setTaskState({ tasks: [], status: 'idle', error: '' });
      return;
    }
    setTaskState((current) => ({ ...current, status: 'loading', error: '' }));
    try {
      const { tasks } = await api.tasks(`?projectId=${encodeURIComponent(nextProjectId)}`);
      if (requestId !== taskRequest.current) return;
      setTaskState({ tasks, status: 'ready', error: '' });
    } catch (error) {
      if (requestId !== taskRequest.current) return;
      setTaskState((current) => ({
        ...current,
        status: 'error',
        error: error.message || 'Unable to load project tasks',
      }));
    }
  }, [projectId]);

  useEffect(() => {
    loadCore();
    return () => {
      coreRequest.current += 1;
    };
  }, [loadCore]);

  useEffect(() => {
    loadTasks(projectId);
    return () => {
      taskRequest.current += 1;
    };
  }, [projectId, loadTasks]);

  return {
    ...core,
    tasks: taskState.tasks,
    taskStatus: taskState.status,
    taskError: taskState.error,
    reloadCore: loadCore,
    reloadTasks: loadTasks,
    clearTasks: () => setTaskState({ tasks: [], status: 'idle', error: '' }),
  };
}
