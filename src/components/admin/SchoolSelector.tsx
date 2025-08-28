import { useState, useEffect, useCallback } from 'react';
import { Organization } from '@prisma/client';

interface SchoolSelectorProps {
  selectedSchoolId: string;
  selectedDepartmentId: string;
  onSchoolChange: (schoolId: string) => void;
  onDepartmentChange: (departmentId: string) => void;
  showDepartments?: boolean;
  className?: string;
  disabled?: boolean;
  showResetButton?: boolean;
  onReset?: () => void;
}

export function SchoolSelector({
  selectedSchoolId,
  selectedDepartmentId,
  onSchoolChange,
  onDepartmentChange,
  showDepartments = true,
  className = '',
  disabled = false,
  showResetButton = false,
  onReset
}: SchoolSelectorProps) {
  const [schools, setSchools] = useState<Organization[]>([]);
  const [departments, setDepartments] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(false);

  // 获取学校列表
  const fetchSchools = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/organizations?type=SCHOOL');
      if (response.ok) {
        const data = await response.json();
        setSchools(data);
      }
    } catch (err) {
      console.error('获取学校列表失败:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // 获取院系列表
  const fetchDepartments = useCallback(async (schoolId: string) => {
    if (!schoolId) {
      setDepartments([]);
      return;
    }
    try {
      const response = await fetch(`/api/admin/organizations?type=DEPARTMENT&parentId=${schoolId}`);
      if (response.ok) {
        const data = await response.json();
        setDepartments(data);
      }
    } catch (err) {
      console.error('获取院系列表失败:', err);
    }
  }, []);

  useEffect(() => {
    fetchSchools();
  }, [fetchSchools]);

  useEffect(() => {
    fetchDepartments(selectedSchoolId);
    // 当学校改变时，如果当前选择的院系不属于新学校，则重置院系选择
    if (selectedSchoolId && selectedDepartmentId) {
      // 这里可以添加验证逻辑，确保院系属于选中的学校
    }
}, [selectedSchoolId, selectedDepartmentId, fetchDepartments]);

  const handleSchoolChange = (schoolId: string) => {
    onSchoolChange(schoolId);
    // 当学校改变时，重置院系选择
    if (selectedDepartmentId) {
      onDepartmentChange('');
    }
  };

  const gridCols = showDepartments ? (showResetButton ? 'md:grid-cols-3' : 'md:grid-cols-2') : (showResetButton ? 'md:grid-cols-2' : 'md:grid-cols-1');

  return (
    <div className={`bg-gray-50 p-4 rounded-lg ${className}`}>
      <h4 className="text-sm font-semibold text-gray-700 mb-3">筛选条件</h4>
      <div className={`grid grid-cols-1 ${gridCols} gap-4`}>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">所属学校</label>
          <select
            value={selectedSchoolId}
            onChange={(e) => handleSchoolChange(e.target.value)}
            disabled={disabled || loading}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
          >
            <option value="">全部学校</option>
            {schools.map(school => (
              <option key={school.id} value={school.id}>{school.name}</option>
            ))}
          </select>
        </div>
        
        {showDepartments && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">所属院系</label>
            <select
              value={selectedDepartmentId}
              onChange={(e) => onDepartmentChange(e.target.value)}
              disabled={disabled || !selectedSchoolId}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              <option value="">全部院系</option>
              {departments.map(dept => (
                <option key={dept.id} value={dept.id}>{dept.name}</option>
              ))}
            </select>
          </div>
        )}
        
        {showResetButton && onReset && (
          <div className="flex items-end">
            <button
              onClick={onReset}
              disabled={disabled}
              className="w-full px-4 py-2 bg-gray-500 text-white font-semibold rounded-md hover:bg-gray-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              重置筛选
            </button>
          </div>
        )}
      </div>
      
      {loading && (
        <div className="mt-2 text-sm text-gray-500">正在加载...</div>
      )}
    </div>
  );
}