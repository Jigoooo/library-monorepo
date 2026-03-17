import { describe, it, expect } from 'vitest';

import { deepCamelCase } from '../utils/camelize';

describe('deepCamelCase', () => {
  it('단순 snake_case를 camelCase로 변환', () => {
    const input = {
      user_name: 'John',
      user_email: 'john@example.com',
    };

    const result = deepCamelCase(input);

    expect(result).toEqual({
      userName: 'John',
      userEmail: 'john@example.com',
    });
  });

  it('중첩 객체를 재귀적으로 변환', () => {
    const input = {
      user_info: {
        first_name: 'John',
        last_name: 'Doe',
        user_settings: {
          notification_enabled: true,
        },
      },
    };

    const result = deepCamelCase(input);

    expect(result).toEqual({
      userInfo: {
        firstName: 'John',
        lastName: 'Doe',
        userSettings: {
          notificationEnabled: true,
        },
      },
    });
  });

  it('배열 요소들을 변환', () => {
    const input = {
      users: [
        { user_id: 1, user_name: 'Alice' },
        { user_id: 2, user_name: 'Bob' },
      ],
    };

    const result = deepCamelCase(input);

    expect(result).toEqual({
      users: [
        { userId: 1, userName: 'Alice' },
        { userId: 2, userName: 'Bob' },
      ],
    });
  });

  it('배열이 객체의 일부인 경우', () => {
    const input = {
      user_list: [{ user_name: 'John' }, { user_name: 'Jane' }],
    };

    const result = deepCamelCase(input);

    expect(result).toEqual({
      userList: [{ userName: 'John' }, { userName: 'Jane' }],
    });
  });

  it('null 값을 그대로 통과', () => {
    const input = {
      user_name: null,
    };

    const result = deepCamelCase(input);

    expect(result).toEqual({
      userName: null,
    });
  });

  it('원시 값(string, number, boolean)은 그대로 반환', () => {
    expect(deepCamelCase('test_value')).toBe('test_value');
    expect(deepCamelCase(123)).toBe(123);
    expect(deepCamelCase(true)).toBe(true);
  });

  it('빈 객체 처리', () => {
    const result = deepCamelCase({});
    expect(result).toEqual({});
  });

  it('빈 배열 처리', () => {
    const result = deepCamelCase([]);
    expect(result).toEqual([]);
  });
});
