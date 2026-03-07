import { useMemo, useRef, useEffect, useState } from "react";
import ForceGraph3D from "react-force-graph-3d";
import { useLifeOSStore } from "../store/useLifeOSStore";
import { useTheme } from "../hooks/useTheme";

type Node = { id: string; group: number; val: number; name: string };
type Link = { source: string; target: string; value: number };

export function KnowledgeGraph() {
    const { records } = useLifeOSStore();
    const { theme } = useTheme();
    const containerRef = useRef<HTMLDivElement>(null);
    const [dimensions, setDimensions] = useState({ width: 800, height: 400 });

    useEffect(() => {
        if (containerRef.current) {
            const { clientWidth, clientHeight } = containerRef.current;
            setDimensions({ width: clientWidth, height: clientHeight || 400 });
        }

        const handleResize = () => {
            if (containerRef.current) {
                setDimensions({ width: containerRef.current.clientWidth, height: containerRef.current.clientHeight || 400 });
            }
        }
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    const graphData = useMemo(() => {
        if (!records.length) return { nodes: [], links: [] };

        const nodes: Map<string, Node> = new Map();
        const links: Map<string, Link> = new Map();

        // Helper to add nodes
        const addNode = (id: string, group: number, val: number, name: string) => {
            if (!nodes.has(id)) {
                nodes.set(id, { id, group, val, name });
            } else {
                nodes.get(id)!.val += val;
            }
        };

        const addLink = (source: string, target: string, value: number = 1) => {
            if (source === target) return;
            const linkId = [source, target].sort().join("-");
            if (!links.has(linkId)) {
                links.set(linkId, { source, target, value });
            } else {
                links.get(linkId)!.value += value;
            }
        };

        records.forEach((record) => {
            // Create Source Node
            const sourceNodeId = `source_${record.sourceId}`;
            addNode(sourceNodeId, 1, 5, `Source: ${record.sourceId}`);

            // Process Categories
            Object.entries(record.categoricalFields).forEach(([catKey, catVal]) => {
                if (!catVal) return;
                const catNodeId = `cat_${catVal}`;
                addNode(catNodeId, 2, 8, catVal);
                addLink(sourceNodeId, catNodeId, 2);

                // Process Keywords and link to category
                record.keywords.forEach((kw) => {
                    const kwNodeId = `kw_${kw}`;
                    addNode(kwNodeId, 3, 3, kw);
                    addLink(catNodeId, kwNodeId, 1);
                });
            });
        });

        // Filter out very small keyword nodes to keep it clean, keep top ones
        const sortedNodes = Array.from(nodes.values()).sort((a, b) => b.val - a.val).slice(0, 100);
        const validIds = new Set(sortedNodes.map(n => n.id));

        const filteredLinks = Array.from(links.values()).filter(l => validIds.has(l.source) && validIds.has(l.target));

        return { nodes: sortedNodes, links: filteredLinks };
    }, [records]);

    if (!records.length) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-center h-[400px]">
                <p className="text-sm text-navy-500 dark:text-slate-400 max-w-xs">
                    Add data to visualize your personal knowledge graph.
                </p>
            </div>
        );
    }

    return (
        <div ref={containerRef} className="w-full h-[500px] overflow-hidden rounded-[calc(1.5rem-1px)]">
            <ForceGraph3D
                width={dimensions.width}
                height={dimensions.height}
                graphData={graphData}
                nodeLabel="name"
                nodeAutoColorBy="group"
                nodeResolution={16}
                linkWidth={(link) => Math.min((link as any).value, 5)}
                linkColor={() => theme === 'dark' ? 'rgba(212, 165, 116, 0.2)' : 'rgba(26, 35, 64, 0.1)'}
                backgroundColor={theme === 'dark' ? 'rgba(15, 23, 42, 0)' : 'rgba(255, 255, 255, 0)'}
                enableNodeDrag={false}
            />
        </div>
    );
}
