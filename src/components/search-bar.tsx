import { CalendarDays, MapPin, Search, Users } from "lucide-react";

export function SearchBar({ compact = false }: { compact?: boolean }) {
  return (
    <form className={compact ? "search-bar compact" : "search-bar"} action="/search">
      <label><span><MapPin size={17} /> Destination</span><input name="destination" defaultValue={compact ? "Mombasa" : ""} placeholder="Where on the coast?" /></label>
      <label><span><CalendarDays size={17} /> Check in</span><input type="date" name="checkIn" /></label>
      <label><span><CalendarDays size={17} /> Check out</span><input type="date" name="checkOut" /></label>
      <label><span><Users size={17} /> Guests</span><input name="guests" defaultValue="2 guests, 1 room" /></label>
      <button className="button search-button" type="submit"><Search size={19} /> Search</button>
    </form>
  );
}
