
import { describe, it, expect, vi } from 'vitest';

// Mock supabaseClient BEFORE importing the service
vi.mock('./supabaseClient', () => ({
    supabase: {
        from: vi.fn(),
        auth: {
            getSession: vi.fn()
        }
    }
}));

import { removePersonsFromTemplates } from './einstellungenService.js';

describe('removePersonsFromTemplates', () => {
    it('should remove deleted persons from anwesenheit', () => {
        const vorlagen = [
            {
                id: '1',
                name: 'Test Template',
                inhalt: {
                    anwesenheit: 'Max, Anna, Tom',
                    abwesend: '',
                    wer_geht_essen: '',
                    planung: {}
                }
            }
        ];
        const deletedPersons = ['Anna'];

        const { updatedVorlagen, changed } = removePersonsFromTemplates(vorlagen, deletedPersons);

        expect(changed).toBe(true);
        expect(updatedVorlagen[0].inhalt.anwesenheit).toBe('Max, Tom');
    });

    it('should remove deleted persons from planung', () => {
        const vorlagen = [
            {
                id: '1',
                name: 'Test Template',
                inhalt: {
                    anwesenheit: 'Max, Anna',
                    planung: {
                        'slot1': {
                            'room1': 'Anna, Max'
                        }
                    }
                }
            }
        ];
        const deletedPersons = ['Anna'];

        const { updatedVorlagen, changed } = removePersonsFromTemplates(vorlagen, deletedPersons);

        expect(changed).toBe(true);
        expect(updatedVorlagen[0].inhalt.planung.slot1.room1).toBe('Max');
        expect(updatedVorlagen[0].inhalt.anwesenheit).toBe('Max');
    });

    it('should not change anything if person not found', () => {
        const vorlagen = [
            {
                id: '1',
                name: 'Test Template',
                inhalt: {
                    anwesenheit: 'Max, Tom',
                    planung: {}
                }
            }
        ];
        const deletedPersons = ['Anna'];

        const { updatedVorlagen, changed } = removePersonsFromTemplates(vorlagen, deletedPersons);

        expect(changed).toBe(false);
        expect(updatedVorlagen[0].inhalt.anwesenheit).toBe('Max, Tom');
    });

    it('should handle empty strings and nulls gracefully', () => {
        const vorlagen = [
            {
                id: '1',
                name: 'Test Template',
                inhalt: {
                    anwesenheit: '',
                    abwesend: null,
                    planung: {}
                }
            }
        ];
        const deletedPersons = ['Anna'];

        const { updatedVorlagen, changed } = removePersonsFromTemplates(vorlagen, deletedPersons);

        expect(changed).toBe(false);
        expect(updatedVorlagen[0].inhalt.anwesenheit).toBe('');
        expect(updatedVorlagen[0].inhalt.abwesend).toBe(null);
    });
});
