/**
 * MappingShow
 *
 * @author: exode <hello@exode.ru>
 */

import React from 'react';

import { If } from '@/cutils';
import { MappingTaskAnswer, MappingTaskQuestion } from '@/shared/types';

import { TaskBuilderShowProps } from '@/components/Task/Builder';

import { useMapping } from './hooks/useMapping';
import { DragLineAtom } from './atoms/DragLineAtom';
import { MappingItemAtom } from './atoms/MappingItemAtom';
import { ConnectionLineAtom } from './atoms/ConnectionLineAtom';


interface Props extends TaskBuilderShowProps<
    MappingTaskQuestion,
    MappingTaskAnswer
> {

}


const MappingShow = (props: Props) => {

    const { task: { question }, answer = {}, subMode } = props;

    const {
        dragLine,
        connections,
        containerRef,
        selectedFirst,
        selectedSecond,
        connectedPairs,
        unconnectedFirst,
        unconnectedSecond,
        handleItemClick,
        handleDragStart,
        handleMouseMove,
        removeConnection,
        getItemPosition,
        isItemConnected,
    } = useMapping({ 
        question, 
        answer,
        initialAnswer: subMode === 'preview' ? answer : undefined
    });

    const isDisabled = subMode === 'result';
    const canRemoveConnections = subMode !== 'result';

    return (
        <div 
            ref={containerRef} 
            onMouseMove={isDisabled ? undefined : handleMouseMove} 
            className={`relative w-full mx-auto ${isDisabled ? 'pointer-events-none' : ''}`}
        >
            <div className="grid grid-cols-2 gap-10 m:gap-8">
                {/** Left column */}
                <div className="space-y-3">
                    {connectedPairs.map((pair) => (
                        <If is={!!pair.first?.text}>
                            <MappingItemAtom item={pair.first}
                                             key={pair.first.uuid}
                                             isSelected={selectedFirst === pair.first.uuid}
                                             isConnected={isItemConnected(pair.first.uuid)}
                                             onClick={isDisabled ? undefined : (uuid, text) => handleItemClick('first', uuid, text)}
                                             onDragStart={isDisabled ? undefined : (e, uuid, text) => handleDragStart('first', e, uuid, text)}
                                             onMouseUp={(
                                                 selectedSecond && !isDisabled
                                                     ? () => handleItemClick(
                                                         'first',
                                                         pair.first.uuid,
                                                         pair.first.text,
                                                     )
                                                     : undefined
                                             )}/>
                        </If>
                    ))}

                    {unconnectedFirst.map((item) => (
                        <If is={!!item.text}>
                            <MappingItemAtom item={item}
                                             key={item.uuid}
                                             isSelected={selectedFirst === item.uuid}
                                             isConnected={isItemConnected(item.uuid)}
                                             onClick={isDisabled ? undefined : (uuid, text) => handleItemClick('first', uuid, text)}
                                             onDragStart={isDisabled ? undefined : (e, uuid, text) => handleDragStart('first', e, uuid, text)}
                                             onMouseUp={(
                                                 selectedSecond && !isDisabled
                                                     ? () => handleItemClick(
                                                         'first',
                                                         item.uuid,
                                                         item.text,
                                                     )
                                                     : undefined
                                             )}/>
                        </If>
                    ))}
                </div>

                {/** Right column */}
                <div className="space-y-3">
                    {connectedPairs.map((pair) => (
                        <If is={!!pair.second?.text}>
                            <MappingItemAtom item={pair.second}
                                             key={pair.second.uuid}
                                             isSelected={selectedSecond === pair.second.uuid}
                                             isConnected={isItemConnected(pair.second.uuid)}
                                             onClick={isDisabled ? undefined : (uuid, text) => handleItemClick('second', uuid, text)}
                                             onDragStart={isDisabled ? undefined : (e, uuid, text) => handleDragStart('second', e, uuid, text)}
                                             onMouseUp={(
                                                 selectedFirst && !isDisabled
                                                     ? () => handleItemClick(
                                                         'second',
                                                         pair.second.uuid,
                                                         pair.second.text,
                                                     )
                                                     : undefined
                                             )}/>
                        </If>
                    ))}

                    {unconnectedSecond.map((item) => (
                        <If is={!!item.text}>
                            <MappingItemAtom item={item}
                                             key={item.uuid}
                                             isConnected={isItemConnected(item.uuid)}
                                             isSelected={selectedSecond === item.uuid}
                                             onClick={isDisabled ? undefined : (uuid, text) => handleItemClick('second', uuid, text)}
                                             onDragStart={isDisabled ? undefined : (e, uuid, text) => handleDragStart('second', e, uuid, text)}
                                             onMouseUp={(
                                                 selectedFirst && !isDisabled
                                                     ? () => handleItemClick(
                                                         'second',
                                                         item.uuid,
                                                         item.text,
                                                     )
                                                     : undefined
                                             )}/>
                        </If>
                    ))}
                </div>
            </div>

            {/** SVG lines */}
            <svg className="absolute inset-0 pointer-events-none w-full h-full z-[1]">
                <DragLineAtom dragLine={dragLine}/>

                {connections.map((connection) => (
                    <ConnectionLineAtom key={connection.id}
                                        connection={connection}
                                        onRemove={canRemoveConnections ? removeConnection : undefined}
                                        selectedFirst={selectedFirst}
                                        selectedSecond={selectedSecond}
                                        getItemPosition={getItemPosition}/>
                ))}
            </svg>
        </div>
    );
};


export { MappingShow };