/**
 * ArrangeEdit styled container
 *
 * @author: exode <hello@exode.ru>
 */

import styled from 'styled-components';


export const Container = styled.div`
    .skip-word {
        cursor: text;
        outline: none;
        position: relative;
        display: inline-block;
    }

    .skip-word:focus {
        box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.3);
    }

    .skip-word:focus::after {
        content: '';
        position: absolute;
        left: 0;
        right: 0;
        bottom: -1px;
        height: 2px;
        background-color: #8B5CF6;
    }

    .skip-word-wrapper {
        display: inline;
        white-space: pre-wrap;
    }

    .skip-word.skip-word--active {
        box-shadow: inset 0 0 0 2px var(--dynamic_green);
    }

    /* Show icons for FillSpaces types using background-image */
    .skip-word-wrapper[data-fill-type='select'] [data-skip-uuid],
    .skip-word-wrapper[data-fill-type='fill'] [data-skip-uuid] {
        position: relative;
        padding-left: 26px;
    }

    .skip-word-wrapper[data-fill-type='select'] [data-skip-uuid]::after {
        content: '';
        position: absolute;
        top: 50%;
        left: 6px;
        width: 16px;
        height: 16px;
        transform: translateY(-50%);
        background-image: url('data:image/svg+xml;charset=utf-8,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"%3E%3Cpath fill="%23666666" d="M3 6h18a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1zm2 3h2v2H5V9zm3 0h2v2H8V9zm3 0h2v2h-2V9zm3 0h2v2h-2V9zm3 0h2v2h-2V9zM5 12h14v2H5v-2z"/%3E%3C/svg%3E');
        background-size: contain;
        background-repeat: no-repeat;
        background-position: center;
    }

    .skip-word-wrapper[data-fill-type='fill'] [data-skip-uuid]::after {
        content: '';
        position: absolute;
        top: 50%;
        left: 6px;
        width: 16px;
        height: 16px;
        transform: translateY(-50%);
        background-image: url('data:image/svg+xml;charset=utf-8,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"%3E%3Cpath fill="%23666666" d="M7 7h13v2H7V7zM4 7h2v2H4V7zm3 5h13v2H7v-2zM4 12h2v2H4v-2zm3 5h13v2H7v-2zM4 17h2v2H4v-2z"/%3E%3C/svg%3E');
        background-size: contain;
        background-repeat: no-repeat;
        background-position: center;
    }

    /* Dark theme support */
    @media (prefers-color-scheme: dark) {
        .skip-word-wrapper[data-fill-type='select'] [data-skip-uuid]::after {
            background-image: url('data:image/svg+xml;charset=utf-8,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"%3E%3Cpath fill="%23ffffff" d="M3 6h18a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1zm2 3h2v2H5V9zm3 0h2v2H8V9zm3 0h2v2h-2V9zm3 0h2v2h-2V9zm3 0h2v2h-2V9zM5 12h14v2H5v-2z"/%3E%3C/svg%3E');
        }

        .skip-word-wrapper[data-fill-type='fill'] [data-skip-uuid]::after {
            background-image: url('data:image/svg+xml;charset=utf-8,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"%3E%3Cpath fill="%23ffffff" d="M7 7h13v2H7V7zM4 7h2v2H4V7zm3 5h13v2H7v-2zM4 12h2v2H4v-2zm3 5h13v2H7v-2zM4 17h2v2H4v-2z"/%3E%3C/svg%3E');
        }
    }

    /* Dynamic theme support using CSS custom properties */
    [data-theme="dark"] .skip-word-wrapper[data-fill-type='select'] [data-skip-uuid]::after,
    [data-theme="dark"] .skip-word-wrapper[data-fill-type='fill'] [data-skip-uuid]::after {
        filter: brightness(0) invert(1);
    }
`;