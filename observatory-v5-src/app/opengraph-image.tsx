import {ImageResponse} from "next/og";

export const dynamic="force-static";
export const alt="Maharshi Patel — AI Systems Engineer";
export const size={width:1200,height:630};
export const contentType="image/png";

export default function Image(){
  return new ImageResponse(
    <div style={{
      width:"100%",height:"100%",display:"flex",flexDirection:"column",justifyContent:"space-between",
      background:"#050708",color:"#f0ede5",padding:"72px 82px",fontFamily:"Arial, sans-serif",
      position:"relative",overflow:"hidden"
    }}>
      <div style={{position:"absolute",inset:0,display:"flex",background:"radial-gradient(circle at 78% 24%, rgba(159,220,255,.20), transparent 34%), radial-gradient(circle at 22% 78%, rgba(243,160,108,.15), transparent 38%)"}}/>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:22,letterSpacing:3,color:"#9aa4a2",zIndex:1}}>
        <span>MAHARSHI PATEL</span><span>AI SYSTEMS / 2026</span>
      </div>
      <div style={{display:"flex",flexDirection:"column",zIndex:1}}>
        <div style={{display:"flex",fontSize:92,fontWeight:700,letterSpacing:-5,lineHeight:.92}}>AI SYSTEMS</div>
        <div style={{display:"flex",fontSize:92,fontWeight:700,letterSpacing:-5,lineHeight:.92,color:"#9fdcff"}}>ENGINEER.</div>
        <div style={{display:"flex",marginTop:34,fontSize:30,color:"#d3d9d6",maxWidth:870,lineHeight:1.35}}>
          Agentic AI · RAG · Document Intelligence · Evaluation · MLOps
        </div>
      </div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",zIndex:1}}>
        <div style={{display:"flex",gap:18,fontSize:24,fontWeight:700}}>
          <span style={{color:"#9fdcff"}}>KNOW.</span><span style={{color:"#f3a06c"}}>ACT.</span><span style={{color:"#a9c9b0"}}>PROVE.</span>
        </div>
        <div style={{display:"flex",fontSize:20,color:"#98a19f"}}>Paris · Open to AI engineering opportunities</div>
      </div>
    </div>,
    size
  );
}
